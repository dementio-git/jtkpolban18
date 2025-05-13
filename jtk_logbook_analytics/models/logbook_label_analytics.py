from odoo import models, fields, tools, api

class LogbookLabelAnalytics(models.Model):
    _name = 'logbook.label.analytics'
    _description = 'Analisis Frekuensi Label Logbook'
    _auto = False

    label_id = fields.Many2one('logbook.label', string='Label')
    week_id = fields.Many2one('week.line', string='Minggu')
    project_course_id = fields.Many2one('project.course', string='Mata Kuliah')
    class_id = fields.Many2one('class.class', string='Kelas')
    count = fields.Integer(string='Jumlah')
    total_point = fields.Float(string='Total Poin')

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_label_analytics AS (
                SELECT
                    row_number() OVER () AS id,
                    e.label_id,
                    l.week_id,
                    l.project_course_id,
                    s.class_id,
                    COUNT(e.id) AS count,
                    SUM(e.point) AS total_point
                FROM
                    logbook_extraction e
                JOIN logbook_logbook l ON e.logbook_id = l.id
                JOIN student_student s ON l.student_id = s.id
                WHERE
                    e.label_id IS NOT NULL
                    AND l.week_id IS NOT NULL
                    AND l.project_course_id IS NOT NULL
                    AND s.class_id IS NOT NULL
                    AND e.point IS NOT NULL
                GROUP BY
                    e.label_id,
                    l.week_id,
                    l.project_course_id,
                    s.class_id
            )
        """)
