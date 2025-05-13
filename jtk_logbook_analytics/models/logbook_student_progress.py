from odoo import models, fields, tools

class LogbookStudentProgress(models.Model):
    _name = 'logbook.student.progress'
    _description = 'Perkembangan Poin Mahasiswa per Minggu'
    _auto = False

    student_id = fields.Many2one('student.student', string='Mahasiswa')
    week_id = fields.Many2one('week.line', string='Minggu')
    total_point = fields.Float(string='Total Poin')

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_student_progress AS (
                SELECT
                    row_number() OVER () as id,
                    l.student_id,
                    l.week_id,
                    SUM(e.point) as total_point
                FROM logbook_extraction e
                JOIN logbook_logbook l ON e.logbook_id = l.id
                WHERE l.student_id IS NOT NULL AND l.week_id IS NOT NULL
                GROUP BY l.student_id, l.week_id
            );
        """)
