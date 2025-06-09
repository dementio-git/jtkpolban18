# file: controllers/dashboard_api.py (misal)
from odoo import http
from odoo.http import request

class LogbookDashboardAPI(http.Controller):

    # @http.route('/logbook_dashboard/label_points_by_class', type='json', auth='user')
    # def label_points_by_class(self, project_id, week_id):
    #     # Query ke model logbook.label.analytics
    #     records = request.env['logbook.label.analytics'].sudo().read_group(
    #         domain=[
    #             ('project_course_id', '=', project_id),
    #             ('week_id', '=', week_id)
    #         ],
    #         fields=['label_id', 'class_id', 'total_point:sum'],
    #         groupby=['label_id', 'class_id']
    #     )

    #     result = {}
    #     for rec in records:
    #         label = rec['label_id'][1] if rec['label_id'] else 'Unknown'
    #         kelas = rec['class_id'][1] if rec['class_id'] else 'Unknown'
    #         point = rec['total_point']

    #         if label not in result:
    #             result[label] = {}
    #         result[label][kelas] = point


    @http.route('/logbook/clustering/label', type='json', auth='user')
    def get_label_clustering(self, project_course_id=None, **kw):
        if not project_course_id:
            return {"students": [], "components_info": {}}
        result = request.env['logbook.clustering.service'].cluster_by_label_axes(project_course_id)
        return result

