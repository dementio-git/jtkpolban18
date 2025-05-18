# models/logbook_label_analytics.py
from odoo import models, fields, tools

class LogbookLabelAnalytics(models.Model):
    _name = 'logbook.label.analytics'
    _auto = False
    _description = 'Analisis Frekuensi Label Logbook'

    label_id        = fields.Many2one('logbook.label',        string='Label')
    group_id        = fields.Many2one('logbook.label.group',  string='Label Group')
    student_id      = fields.Many2one('student.student',      string='Mahasiswa')
    student_nim   = fields.Char(string='NIM')
    entry_date = fields.Date(string='Tanggal Entri')
    week_id         = fields.Many2one('week.line',            string='Minggu')
    week_date = fields.Date(string='Tanggal Minggu')  # ⬅️ WAJIB agar field bisa dipanggil via search_read
    project_course_id = fields.Many2one('project.course',    string='Mata Kuliah')
    class_id        = fields.Many2one('class.class',          string='Kelas')
    count           = fields.Integer(string='Jumlah')
    total_point     = fields.Float(  string='Total Poin')

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_label_analytics AS (
                SELECT
                    row_number() OVER ()                          AS id,
                    e.label_id,
                    lbl.group_id,
                    l.student_id,
                    s.nim AS student_nim,                         -- ⬅️ tambahkan ini
                    l.week_id,
                    DATE(l.logbook_date)     AS entry_date, 
                    l.project_course_id,
                    s.class_id,
                    w.start_date AS week_date,
                    COUNT(e.id)           AS count,
                    SUM(e.point)          AS total_point
                FROM logbook_extraction e
                JOIN logbook_logbook      l  ON e.logbook_id = l.id
                JOIN logbook_label        lbl ON e.label_id   = lbl.id
                JOIN student_student      s  ON l.student_id = s.id
                JOIN week_line w ON l.week_id = w.id
                WHERE
                    e.label_id IS NOT NULL
                    AND l.week_id IS NOT NULL
                    AND l.project_course_id IS NOT NULL
                    AND s.class_id IS NOT NULL
                    AND e.point IS NOT NULL
                GROUP BY
                    e.label_id,
                    lbl.group_id,
                    l.student_id,
                    s.nim,                                       -- ⬅️ tambahkan ke GROUP BY
                    l.week_id,
                    DATE(l.logbook_date),   
                    l.project_course_id,
                    s.class_id,
                    w.start_date
            )
        """)

class LogbookLabelWeeklyAvg(models.Model):
    _name = 'logbook.label.weekly.avg'
    _description = 'Rata-Rata Mingguan per Label Group'
    _auto = False

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    group_id          = fields.Many2one('logbook.label.group', string='Label Group', readonly=True)
    week_id           = fields.Many2one('week.line', string='Minggu', readonly=True)
    class_id       = fields.Many2one('class.class', string='Kelas', readonly=True)
    week_date         = fields.Date(string='Tanggal Minggu', readonly=True)
    avg_point         = fields.Float(string='Rata-Rata Poin', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_label_weekly_avg AS (
                SELECT
                    MIN(lla.id) AS id,
                    lla.project_course_id,
                    lla.group_id,
                    lla.class_id,
                    lla.week_id,
                    MIN(lla.week_date) AS week_date,
                    AVG(lla.total_point) AS avg_point
                FROM logbook_label_analytics lla
                WHERE lla.total_point IS NOT NULL
                GROUP BY lla.project_course_id, lla.group_id, lla.class_id, lla.week_id
            )

        """)

