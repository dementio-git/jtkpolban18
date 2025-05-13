# Langkah 1: Buat Controller Dasbor
from odoo import http
from odoo.http import request

class LogbookDashboardController(http.Controller):

    @http.route('/dashboard_logbook', type='http', auth='user', website=False)
    def dashboard_logbook(self):
        return request.render('jtk_logbook_dashboard.dashboard_logbook_template')
    
    @http.route('/dashboard_logbook/project', type='json', auth='user')
    def get_project_data(self):
        query = """
            SELECT pc.id, pc.name, COUNT(*) as count
            FROM logbook_logbook l
            JOIN project_course pc ON l.project_course_id = pc.id
            GROUP BY pc.id, pc.name
        """
        request.env.cr.execute(query)
        result = request.env.cr.fetchall()
        return [{'id': r[0], 'label': r[1], 'count': r[2]} for r in result]

    @http.route('/dashboard_logbook/class/<int:project_id>', type='json', auth='user')
    def get_class_data(self, project_id):
        query = """
            SELECT c.id, c.name, COUNT(*)
            FROM logbook_logbook l
            JOIN student_student s ON l.student_id = s.id
            JOIN student_class c ON s.class_id = c.id
            WHERE l.project_course_id = %s
            GROUP BY c.id, c.name
        """
        request.env.cr.execute(query, (project_id,))
        result = request.env.cr.fetchall()
        return [{'id': r[0], 'label': r[1], 'count': r[2]} for r in result]

    @http.route('/dashboard_logbook/label/<int:project_id>/<int:class_id>', type='json', auth='user')
    def get_label_data(self, project_id, class_id):
        query = """
            SELECT l.label_id, ll.name, COUNT(*)
            FROM logbook_extraction l
            JOIN logbook_logbook lb ON l.logbook_id = lb.id
            JOIN student_student s ON lb.student_id = s.id
            JOIN logbook_label ll ON l.label_id = ll.id
            WHERE lb.project_course_id = %s AND s.class_id = %s
            GROUP BY l.label_id, ll.name
        """
        request.env.cr.execute(query, (project_id, class_id))
        result = request.env.cr.fetchall()
        return [{'id': r[0], 'label': r[1], 'count': r[2]} for r in result]
