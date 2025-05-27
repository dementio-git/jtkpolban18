# models/logbook_label_analytics.py
from odoo import models, fields, tools

class LogbookLabelAnalytics(models.Model):
    _name = 'logbook.label.analytics'
    _auto = False
    _description = 'Analisis Frekuensi Label Logbook'

    label_id        = fields.Many2one('logbook.label',        string='Label')
    group_id        = fields.Many2one('logbook.label.group',  string='Label Group')
    student_id      = fields.Many2one('student.student',      string='Mahasiswa')
    student_nim     = fields.Char(string='NIM')
    entry_date      = fields.Date(string='Tanggal Entri')
    week_id         = fields.Many2one('course.activity',      string='Minggu')
    week_date       = fields.Date(string='Tanggal Minggu')
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
                    s.nim AS student_nim,
                    w.id AS week_id,
                    DATE(l.logbook_date)     AS entry_date, 
                    l.project_course_id,
                    s.class_id,
                    w.start_date AS week_date,
                    COUNT(e.id)           AS count,
                    SUM(e.point)          AS total_point                FROM logbook_extraction e
                JOIN logbook_logbook      l  ON e.logbook_id = l.id
                JOIN logbook_label        lbl ON e.label_id   = lbl.id
                JOIN student_student      s   ON l.student_id = s.id
                JOIN course_activity      w   ON l.week_id = w.id AND w.type = 'week'
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
                    s.nim,
                    w.id,
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
    week_id           = fields.Many2one('course.activity', string='Minggu', readonly=True)
    class_id          = fields.Many2one('class.class', string='Kelas', readonly=True)
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
                GROUP BY 
                    lla.project_course_id, 
                    lla.group_id, 
                    lla.class_id, 
                    lla.week_id
            )
        """)

class LogbookCount(models.Model):
    _name = 'logbook.count'
    _auto = False
    _description = 'Statistik Jumlah Logbook'

    student_id = fields.Many2one('student.student', string='Mahasiswa')
    class_id = fields.Many2one('class.class', string='Kelas')
    project_course_id = fields.Many2one('project.course', string='Mata Kuliah')
    week_id = fields.Many2one('course.activity', string='Minggu')
    week_date = fields.Date(string='Tanggal Minggu')
    logbook_count = fields.Integer(string='Jumlah Logbook')
    start_date = fields.Date(string='Tanggal Awal')
    end_date = fields.Date(string='Tanggal Akhir')

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_count AS (
                WITH LogbookStats AS (
                    SELECT 
                        l.student_id,
                        s.class_id,
                        l.project_course_id,
                        l.week_id,
                        w.start_date as week_date,
                        COUNT(DISTINCT l.id) as logbook_count,
                        MIN(l.logbook_date) as start_date,
                        MAX(l.logbook_date) as end_date
                    FROM logbook_logbook l
                    JOIN student_student s ON l.student_id = s.id
                    LEFT JOIN course_activity w ON l.week_id = w.id AND w.type = 'week'
                    WHERE l.project_course_id IS NOT NULL
                    GROUP BY 
                        GROUPING SETS (
                            (l.student_id, s.class_id, l.project_course_id, l.week_id, w.start_date), -- Per student per week
                            (s.class_id, l.project_course_id, l.week_id, w.start_date),               -- Per class per week
                            (l.project_course_id, l.week_id, w.start_date),                           -- Per project per week
                            (l.student_id, s.class_id, l.project_course_id),                          -- Per student overall
                            (s.class_id, l.project_course_id),                                        -- Per class overall
                            (l.project_course_id)                                                     -- Per project overall
                        )
                )
                SELECT
                    row_number() OVER () as id,
                    student_id,
                    class_id,
                    project_course_id,
                    week_id,
                    week_date,
                    logbook_count,
                    start_date,
                    end_date
                FROM LogbookStats
            )
        """)

class LogbookDescriptiveStats(models.Model):
    _name = 'logbook.descriptive.stats'
    _auto = False
    _description = 'Statistik Deskriptif Logbook'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    total_enrolled_students = fields.Integer(string='Total Mahasiswa Terdaftar')
    total_active_students = fields.Integer(string='Mahasiswa Aktif Logbook')
    total_logbooks = fields.Integer(string='Total Logbook')
    avg_logbooks_per_week = fields.Float(string='Rata-rata Logbook/Minggu')
    avg_active_students_per_week = fields.Float(string='Rata-rata Mahasiswa Aktif/Minggu')
    std_dev_logbooks = fields.Float(string='Std Dev Logbook/Minggu')
    avg_logbooks_per_student_week = fields.Float(string='Rata-rata Logbook/Mahasiswa/Minggu', readonly=True)
    std_dev_logbooks_per_student_week = fields.Float(string='Std Dev Logbook/Mahasiswa/Minggu', readonly=True)
    total_students = fields.Integer(string='Total Mahasiswa', readonly=True)
    std_dev_active_students_per_week = fields.Float(string='Std Dev Mahasiswa Aktif/Minggu', readonly=True)


    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_descriptive_stats AS (
                WITH enrolled_students AS (
                    SELECT 
                        pc.id AS project_course_id,
                        COUNT(DISTINCT s.id) AS total_students
                    FROM project_course pc
                    JOIN class_class_project_course_rel rel ON rel.project_course_id = pc.id
                    JOIN class_class c ON c.id = rel.class_class_id
                    JOIN student_student s ON s.class_id = c.id
                    GROUP BY pc.id
                ),

                weekly_stats AS (
                    SELECT
                        l.project_course_id,
                        l.week_id,
                        COUNT(DISTINCT l.student_id) AS active_students,
                        COUNT(l.id) AS logbook_count
                    FROM logbook_logbook l
                    WHERE l.project_course_id IS NOT NULL AND l.week_id IS NOT NULL
                    GROUP BY l.project_course_id, l.week_id
                ),

                logbook_per_student_week AS (
                    SELECT
                        l.project_course_id,
                        l.week_id,
                        l.student_id,
                        COUNT(l.id) AS logbooks_per_student
                    FROM logbook_logbook l
                    WHERE l.project_course_id IS NOT NULL AND l.week_id IS NOT NULL
                    GROUP BY l.project_course_id, l.week_id, l.student_id
                ),

                project_stats AS (
                    SELECT
                        pc.id AS project_course_id,
                        es.total_students,
                        COALESCE(total_data.total_logbooks, 0) AS total_logbooks,
                        ROUND(AVG(ws.logbook_count)::numeric, 2) AS avg_logbooks_per_week,
                        ROUND(STDDEV(ws.logbook_count)::numeric, 2) AS std_dev_logbooks,
                        ROUND(AVG(ws.active_students)::numeric, 2) AS avg_active_students_per_week,
                        ROUND(STDDEV(ws.active_students)::numeric, 2) AS std_dev_active_students_per_week,
                        ROUND(AVG(lpsw.logbooks_per_student)::numeric, 2) AS avg_logbooks_per_student_week,
                        ROUND(STDDEV(lpsw.logbooks_per_student)::numeric, 2) AS std_dev_logbooks_per_student_week
                    FROM project_course pc
                    JOIN enrolled_students es ON es.project_course_id = pc.id
                    LEFT JOIN (
                        SELECT project_course_id, COUNT(id) AS total_logbooks
                        FROM logbook_logbook
                        WHERE project_course_id IS NOT NULL
                        GROUP BY project_course_id
                    ) total_data ON total_data.project_course_id = pc.id
                    LEFT JOIN weekly_stats ws ON ws.project_course_id = pc.id
                    LEFT JOIN logbook_per_student_week lpsw ON lpsw.project_course_id = pc.id
                    GROUP BY pc.id, es.total_students, total_data.total_logbooks
                )

                SELECT
                    row_number() OVER () AS id,
                    project_course_id,
                    total_students,
                    total_logbooks,
                    avg_logbooks_per_week,
                    avg_active_students_per_week,
                    std_dev_active_students_per_week,
                    std_dev_logbooks,
                    avg_logbooks_per_student_week,
                    std_dev_logbooks_per_student_week 
                FROM project_stats
            );
        """)
        
class LogbookWeeklyStats(models.Model):
    _name = 'logbook.weekly.stats'
    _auto = False
    _description = 'Statistik Per Minggu per Project Course'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    week_id = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    avg_logbooks_per_week = fields.Float(string='Rata-rata Logbook/Minggu', readonly=True)
    avg_active_students_per_week = fields.Float(string='Rata-rata Mahasiswa Aktif/Minggu', readonly=True)
    avg_logbooks_per_student_week = fields.Float(string='Rata-rata Logbook/Mahasiswa/Minggu', readonly=True)
    week_label = fields.Char(string='Label Minggu', readonly=True)

    
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_weekly_stats AS (
                SELECT
                    MIN(l.id) AS id,
                    l.project_course_id,
                    l.week_id,
                    w.start_date AS week_start_date,
                    w.end_date AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY') AS week_label,
                    COUNT(l.id)::float AS avg_logbooks_per_week,
                    COUNT(DISTINCT l.student_id)::float AS avg_active_students_per_week,
                    (COUNT(l.id)::float / NULLIF(COUNT(DISTINCT l.student_id), 0))::float AS avg_logbooks_per_student_week
                FROM logbook_logbook l
                JOIN course_activity w ON w.id = l.week_id AND w.type = 'week'
                WHERE l.week_id IS NOT NULL AND l.project_course_id IS NOT NULL
                GROUP BY l.project_course_id, l.week_id, w.start_date, w.end_date
            )
        """)


class LogbookWeeklyStatsClass(models.Model):
    _name = 'logbook.weekly.stats.class'
    _auto = False
    _description = 'Statistik Per Minggu per Kelas'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    class_id = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name = fields.Char(string='Nama Kelas', readonly=True)
    week_id = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    avg_logbooks_per_week = fields.Float(string='Rata-rata Logbook/Minggu', readonly=True)
    avg_active_students_per_week = fields.Float(string='Rata-rata Mahasiswa Aktif/Minggu', readonly=True)
    avg_logbooks_per_student_week = fields.Float(string='Rata-rata Logbook/Mahasiswa/Minggu', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_weekly_stats_class AS (
                SELECT
                    row_number() OVER () AS id,
                    lc.project_course_id,
                    lc.class_id,
                    c.name AS class_name,
                    lc.week_id,
                    w.start_date AS week_start_date,
                    w.end_date AS week_end_date,
                    COUNT(*)::float AS avg_logbooks_per_week,
                    COUNT(DISTINCT lc.student_id)::float AS avg_active_students_per_week,
                    (COUNT(*)::float / NULLIF(COUNT(DISTINCT lc.student_id), 0))::float AS avg_logbooks_per_student_week
                FROM logbook_count lc
                JOIN class_class c ON c.id = lc.class_id
                JOIN course_activity w ON w.id = lc.week_id AND w.type = 'week'
                WHERE lc.class_id IS NOT NULL AND lc.project_course_id IS NOT NULL AND lc.week_id IS NOT NULL
                GROUP BY lc.project_course_id, lc.class_id, c.name, lc.week_id, w.start_date, w.end_date
            );
                            
        """)
