from odoo import models, api
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from transformers import AutoTokenizer, AutoModel
import torch
import numpy as np
import re
import string

class LogbookSimilarityService(models.TransientModel):
    _name = 'logbook.similarity.service'
    _description = 'Service untuk Analisis Similaritas Logbook'

    def _clean_text(self, text):
        text = text.lower()
        text = text.translate(str.maketrans('', '', string.punctuation))
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _get_tokenizer(self):
        if not hasattr(LogbookSimilarityService, '_tokenizer'):
            LogbookSimilarityService._tokenizer = AutoTokenizer.from_pretrained("indobenchmark/indobert-base-p2")
        return LogbookSimilarityService._tokenizer

    def _get_model(self):
        if not hasattr(LogbookSimilarityService, '_model'):
            LogbookSimilarityService._model = AutoModel.from_pretrained("indobenchmark/indobert-base-p2")
        return LogbookSimilarityService._model

    def _get_bert_embedding(self, text, max_length=128):
        tokenizer = self._get_tokenizer()
        model = self._get_model()

        inputs = tokenizer(text, return_tensors="pt", truncation=True, padding='max_length', max_length=max_length)
        with torch.no_grad():
            outputs = model(**inputs)

        attention_mask = inputs['attention_mask']
        last_hidden_state = outputs.last_hidden_state

        mask = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
        masked_embeddings = last_hidden_state * mask
        summed = masked_embeddings.sum(1)
        counts = torch.clamp(mask.sum(1), min=1e-9)
        mean_pooled = summed / counts

        return mean_pooled.numpy()[0]

    @api.model
    def get_weekly_similarity(self, student_id, project_course_id):
        course = self.env['project.course'].browse(project_course_id)
        alpha = course.alpha or 0.5  # default fallback if not set

        course_weeks = self.env['course.activity'].search([
            ('course_id', '=', project_course_id),
            ('type', '=', 'week')
        ], order='start_date')

        if not course_weeks:
            return {
                "similarity_matrix": [],
                "week_labels": []
            }

        week_mapping = {week.id: idx + 1 for idx, week in enumerate(course_weeks)}

        logbooks_data = self.env['logbook.logbook'].search_read(
            [
                ('student_id', '=', student_id),
                ('project_course_id', '=', project_course_id),
                ('week_id', 'in', course_weeks.ids)
            ],
            ['week_id', 'logbook_content']  # Tentukan field yang ingin diambil
        )


        week_contents = {week.id: [] for week in course_weeks}
        week_labels = [f"W{week_mapping[week.id]}" for week in course_weeks]

        for log_data in logbooks_data:
            # Akses data dari dictionary, bukan record ORM
            week_id = log_data['week_id'][0] # search_read mengembalikan tuple (id, name)
            if week_id in week_contents:
                week_contents[week_id].append(log_data['logbook_content'])
        week_texts = []
        non_empty_weeks = []

        for week in course_weeks:
            contents = week_contents[week.id]
            combined = " ".join(contents)
            cleaned = self._clean_text(combined)
            week_texts.append(cleaned)
            non_empty_weeks.append(bool(cleaned.strip()))

        if not any(non_empty_weeks):
            return {
                "similarity_matrix": [],
                "week_labels": [],
                "empty_weeks": []
            }

        valid_texts = [text for text, valid in zip(week_texts, non_empty_weeks) if valid]
        valid_idx = [i for i, valid in enumerate(non_empty_weeks) if valid]

        # TF-IDF similarity
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(valid_texts)
        tfidf_sim = cosine_similarity(tfidf_matrix)

        # BERT similarity
        bert_embeddings = [self._get_bert_embedding(text) for text in valid_texts]
        bert_sim = cosine_similarity(bert_embeddings)

        # Hybrid similarity
        hybrid_sim = alpha * tfidf_sim + (1 - alpha) * bert_sim

        n_weeks = len(week_texts)
        full_similarity = np.zeros((n_weeks, n_weeks))

        for i, vi in enumerate(valid_idx):
            for j, vj in enumerate(valid_idx):
                full_similarity[vi][vj] = hybrid_sim[i][j]

        return {
            "similarity_matrix": full_similarity.tolist(),
            "week_labels": week_labels,
            "empty_weeks": [i for i, valid in enumerate(non_empty_weeks) if not valid]
        }