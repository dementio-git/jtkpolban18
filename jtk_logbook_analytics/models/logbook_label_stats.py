from odoo import models, fields, api

class LogbookLabelStats(models.Model):
    _name = 'logbook.label.stats'
    _description = 'Statistik Frekuensi Label per Proyek dan Minggu'
    _order = 'project_course_id, week_id, label_id'

    label_id = fields.Many2one('logbook.label', string='Label', required=True)
    week_id = fields.Many2one('week.line', string='Minggu', required=True)
    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', required=True)
    class_id = fields.Many2one('student.class', string='Kelas', required=True)
    count = fields.Integer(string='Jumlah', default=0)

    @api.model
    def compute_label_stats(self):
        self.search([]).unlink()
        self.env.cr.execute("""
            SELECT
                e.label_id,
                l.week_id,
                l.project_course_id,
                s.class_id,
                COUNT(*) as count
            FROM logbook_extraction e
            JOIN logbook_logbook l ON e.logbook_id = l.id
            JOIN student_student s ON l.student_id = s.id
            GROUP BY e.label_id, l.week_id, l.project_course_id, s.class_id
        """)
        rows = self.env.cr.fetchall()
        for label_id, week_id, course_id, class_id, count in rows:
            self.create({
                'label_id': label_id,
                'week_id': week_id,
                'project_course_id': course_id,
                'class_id': class_id,
                'count': count,
            })

    # INI DIA: override method agar compute dipanggil dulu
    @api.model
    def read_group(self, domain, fields, groupby, offset=0, limit=None, orderby=False, lazy=True):
        self.compute_label_stats()  # selalu isi ulang data sebelum tampil
        return super().read_group(domain, fields, groupby, offset=offset, limit=limit, orderby=orderby, lazy=lazy)
