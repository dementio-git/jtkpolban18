from odoo import models, api
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

class LogbookClusteringService(models.TransientModel):
    _name = 'logbook.clustering.service'
    _description = 'Service untuk Clustering Logbook Mahasiswa'

    @api.model
    def cluster_by_label_axes(self, project_course_id, n_clusters=4):
        course = self.env['project.course'].browse(project_course_id)
        if not course.exists():
            return {"students": [], "components_info": {}}

        x_label_ids = set(course.logbook_clustering_x_axis_label_ids.ids)
        y_label_ids = set(course.logbook_clustering_y_axis_label_ids.ids)
        if not x_label_ids or not y_label_ids:
            return {"students": [], "components_info": {}}

        records = self.env['logbook.extraction.student.label.aggregate'].search([
            ('project_course_id', '=', project_course_id)
        ])

        data = [{
            'student_id': r.student_id.id,
            'student_name': r.student_name,
            'label_id': r.label_id.id,
            'point': r.total_point,
        } for r in records]
        df = pd.DataFrame(data)
        if df.empty:
            return {"students": [], "components_info": {}}

        pivot = df.pivot_table(
            index=['student_id', 'student_name'],
            columns='label_id',
            values='point',
            fill_value=0
        ).reset_index()

        def sum_labels(row, label_set):
            return sum(row.get(lid, 0) for lid in label_set)

        pivot['x'] = pivot.apply(lambda r: sum_labels(r, x_label_ids), axis=1)
        pivot['y'] = pivot.apply(lambda r: sum_labels(r, y_label_ids), axis=1)

        scaler = StandardScaler()
        pivot[['x', 'y']] = scaler.fit_transform(pivot[['x', 'y']])

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto')
        pivot['cluster'] = kmeans.fit_predict(pivot[['x', 'y']])
        
        # Urutkan cluster berdasarkan nilai rata-rata X (misal berdasarkan usaha)
        cluster_centers = pivot.groupby('cluster')['x'].mean().sort_values()
        cluster_order = {old: new for new, old in enumerate(cluster_centers.index)}
        pivot['cluster'] = pivot['cluster'].map(cluster_order)


        result = []
        for _, row in pivot.iterrows():
            result.append({
                "student_id": int(row["student_id"]),
                "student_name": row["student_name"],
                "x": float(row["x"]),
                "y": float(row["y"]),
                "cluster": int(row["cluster"]),
            })

        return {
            "students": result,
            "components_info": {
                "x_axis_name": course.logbook_clustering_x_axis_name or "X-Axis",
                "y_axis_name": course.logbook_clustering_y_axis_name or "Y-Axis",
            }
        }
