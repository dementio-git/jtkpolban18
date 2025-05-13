from odoo import models, fields, tools

class LogbookLabelAnalytics(models.Model):
    _name = 'logbook.label.analytics'
    _description = 'Analitik Label per Proyek dan Kelas'
    _auto = False  # pakai SQL view

    label_id = fields.Many2one('logbook.label', string='Label', readonly=True)
    project_course_id = fields.Many2one('project.course', string='Proyek', readonly=True)
    class_id = fields.Many2one('student.class', string='Kelas', readonly=True)
    total_count = fields.Integer(string='Jumlah Data', readonly=True)
    total_point = fields.Float(string='Total Poin', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_label_analytics AS (
                SELECT
                    row_number() OVER () AS id,
                    e.label_id,
                    l.project_course_id,
                    s.class_id,
                    COUNT(*) AS total_count,
                    SUM(e.point) AS total_point
                FROM logbook_extraction e
                JOIN logbook_logbook l ON e.logbook_id = l.id
                JOIN student_student s ON l.student_id = s.id
                GROUP BY e.label_id, l.project_course_id, s.class_id
            );
        """)
