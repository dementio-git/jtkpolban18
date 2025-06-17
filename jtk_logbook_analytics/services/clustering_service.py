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
        point_coef = course.point_coefficient or 1.0
        freq_coef = course.frequency_coefficient or 1.0
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
            'frequency': r.frequency,
        } for r in records]
        df = pd.DataFrame(data)
        if df.empty:
            return {"students": [], "components_info": {}}

        # Create pivot table
        pivot_points = pd.pivot_table(
            df, 
            values='point',
            index=['student_id', 'student_name'],
            columns='label_id',
            fill_value=0
        )
        
        pivot_freq = pd.pivot_table(
            df, 
            values='frequency',
            index=['student_id', 'student_name'],
            columns='label_id',
            fill_value=0
        )

        # Calculate sums for each axis
        x_points = pivot_points[list(x_label_ids)].sum(axis=1) * point_coef
        y_points = pivot_points[list(y_label_ids)].sum(axis=1) * point_coef
        x_freq = pivot_freq[list(x_label_ids)].sum(axis=1) * freq_coef
        y_freq = pivot_freq[list(y_label_ids)].sum(axis=1) * freq_coef

        # Create result DataFrame with index from pivot_points
        result_df = pd.DataFrame({
            'x': x_points + x_freq,
            'y': y_points + y_freq
        }, index=pivot_points.index)

        # Normalize
        scaler = StandardScaler()
        result_df[['x', 'y']] = scaler.fit_transform(result_df[['x', 'y']])

        # Perform clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto')
        result_df['cluster'] = kmeans.fit_predict(result_df[['x', 'y']])

        # Order clusters by x mean
        cluster_centers = result_df.groupby('cluster')['x'].mean().sort_values()
        cluster_order = {old: new for new, old in enumerate(cluster_centers.index)}
        result_df['cluster'] = result_df['cluster'].map(cluster_order)

        # Reset index to get student info as columns and sort
        result_df = result_df.reset_index()
        result_df = result_df.sort_values('student_id')

        # Build students list
        students_list = []
        for _, row in result_df.iterrows():
            students_list.append({
                "student_id": int(row['student_id']),
                "student_name": str(row['student_name']),
                "x": float(row['x']),
                "y": float(row['y']),
                "cluster": int(row['cluster'])
            })

        result = {
            "students": students_list,
            "components_info": {
                "x_axis_name": course.logbook_clustering_x_axis_name or "X-Axis",
                "y_axis_name": course.logbook_clustering_y_axis_name or "Y-Axis",
                "legend": [s["student_name"] for s in students_list]
            }
        }

        return result