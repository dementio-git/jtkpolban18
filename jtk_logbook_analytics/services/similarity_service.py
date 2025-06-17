from odoo import models, api
from transformers import AutoTokenizer, AutoModel
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import torch
import re
import string

class LogbookSimilarityService(models.TransientModel):
    _name = 'logbook.similarity.service'
    _description = 'Service untuk Analisis Similaritas Logbook'

    def _get_tokenizer(self):
        if not hasattr(LogbookSimilarityService, '_tokenizer'):
            LogbookSimilarityService._tokenizer = AutoTokenizer.from_pretrained("indobenchmark/indobert-base-p2")
        return LogbookSimilarityService._tokenizer

    def _get_model(self):
        if not hasattr(LogbookSimilarityService, '_model'):
            LogbookSimilarityService._model = AutoModel.from_pretrained("indobenchmark/indobert-base-p2")
        return LogbookSimilarityService._model

    def _clean_text(self, text):
        # Hilangkan tanda baca dan spasi ganda
        text = text.translate(str.maketrans('', '', string.punctuation))
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _get_embedding(self, text, max_length=128):
        tokenizer = self._get_tokenizer()
        model = self._get_model()

        text = self._clean_text(text)
        inputs = tokenizer(text, return_tensors="pt", truncation=True, padding='max_length', max_length=max_length)

        with torch.no_grad():
            outputs = model(**inputs)

        attention_mask = inputs['attention_mask']
        last_hidden_state = outputs.last_hidden_state

        # Mean Pooling
        mask = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
        masked_embeddings = last_hidden_state * mask
        summed = masked_embeddings.sum(1)
        counts = torch.clamp(mask.sum(1), min=1e-9)
        mean_pooled = summed / counts

        return mean_pooled.numpy()

    @api.model
    def get_weekly_similarity(self, student_id, project_course_id):
        course_weeks = self.env['course.activity'].search([
            ('course_id', '=', project_course_id),
            ('type', '=', 'week')
        ], order='start_date')

        if not course_weeks:
            return {
                "similarity_matrix": [],
                "week_labels": []
            }

        week_mapping = {
            week.id: idx + 1
            for idx, week in enumerate(course_weeks)
        }

        logbooks = self.env['logbook.logbook'].search([
            ('student_id', '=', student_id),
            ('project_course_id', '=', project_course_id),
            ('week_id', 'in', course_weeks.ids)
        ])

        week_contents = {week.id: [] for week in course_weeks}
        week_labels = [f"W{week_mapping[week.id]}" for week in course_weeks]

        for log in logbooks:
            if log.week_id.id in week_contents:
                week_contents[log.week_id.id].append(log.logbook_content)

        week_texts = []
        non_empty_weeks = []

        for week in course_weeks:
            contents = week_contents[week.id]
            combined_text = " ".join(contents) if contents else ""
            week_texts.append(combined_text)
            non_empty_weeks.append(bool(combined_text.strip()))

        if not any(non_empty_weeks):
            return {
                "similarity_matrix": [],
                "week_labels": [],
                "empty_weeks": []
            }

        valid_texts = [text for text, valid in zip(week_texts, non_empty_weeks) if valid]
        embeddings = [self._get_embedding(text)[0] for text in valid_texts] if valid_texts else []

        valid_similarity = cosine_similarity(embeddings) if embeddings else np.array([[]])

        n_weeks = len(week_texts)
        full_similarity = np.zeros((n_weeks, n_weeks))
        valid_idx = [i for i, valid in enumerate(non_empty_weeks) if valid]

        for i, vi in enumerate(valid_idx):
            for j, vj in enumerate(valid_idx):
                full_similarity[vi][vj] = valid_similarity[i][j]

        return {
            "similarity_matrix": full_similarity.tolist(),
            "week_labels": week_labels,
            "empty_weeks": [i for i, valid in enumerate(non_empty_weeks) if not valid]
        }
