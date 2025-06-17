from odoo import models, api
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

class LogbookSimilarityService(models.TransientModel):
    _name = 'logbook.similarity.service'
    _description = 'Service untuk Analisis Similaritas Logbook'

    def __init__(self):
        super().__init__()
        # Load IndoBERT model saat inisialisasi
        self.model = SentenceTransformer('indobenchmark/indobert-base-p1')

    @api.model
    def get_weekly_similarity(self, student_id, project_course_id):
        # Ambil data logbook per minggu untuk mahasiswa
        logbooks = self.env['logbook.logbook'].search([
            ('student_id', '=', student_id),
            ('project_course_id', '=', project_course_id),
        ], order='week_id')

        # Group logbook by week
        week_contents = {}
        week_labels = []
        for log in logbooks:
            if log.week_id not in week_contents:
                week_contents[log.week_id.id] = []
                week_labels.append(f"W{len(week_labels) + 1}")
            week_contents[log.week_id.id].append(log.content)

        # Combine content per week
        week_texts = []
        for week_id in week_contents:
            combined_text = " ".join(week_contents[week_id])
            week_texts.append(combined_text)

        if not week_texts:
            return {
                "similarity_matrix": [],
                "week_labels": []
            }

        # Generate embeddings
        embeddings = self.model.encode(week_texts)
        
        # Calculate cosine similarity
        similarity_matrix = cosine_similarity(embeddings)

        return {
            "similarity_matrix": similarity_matrix.tolist(),
            "week_labels": week_labels
        }