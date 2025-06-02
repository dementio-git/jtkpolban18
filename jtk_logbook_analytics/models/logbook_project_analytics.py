# logbook_project_analytics.py

from odoo import models, fields, tools

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

class LogbookExtractionWeekly(models.Model):
    _name = 'logbook.extraction.weekly'
    _auto = False
    _description = 'Tren Ekstraksi Logbook per Proyek per Minggu'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    week_id           = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date   = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date     = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label        = fields.Char(string='Label Minggu', readonly=True)
    extraction_count  = fields.Integer(string='Jumlah Ekstraksi (poin ≠ 0)', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly AS (
                SELECT
                    MIN(e.id)                                             AS id,
                    lb.project_course_id                                 AS project_course_id,
                    lb.week_id                                           AS week_id,
                    w.start_date                                         AS week_start_date,
                    w.end_date                                           AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY')                 AS week_label,
                    COUNT(e.id)                                          AS extraction_count
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON e.logbook_id = lb.id
                JOIN course_activity w ON lb.week_id = w.id AND w.type = 'week'
                WHERE
                    lb.project_course_id IS NOT NULL
                    AND e.content IS NOT NULL
                    AND e.content != ''
                GROUP BY
                    lb.project_course_id,
                    lb.week_id,
                    w.start_date,
                    w.end_date
            )
        """)
        
class LogbookExtractionDescriptiveStats(models.Model):
    _name = 'logbook.extraction.descriptive.stats'
    _auto = False
    _description = 'Statistik Deskriptif Ekstraksi Logbook'

    avg_extraction_per_logbook      = fields.Float(string='Rata-rata Ekstraksi per Logbook', readonly=True)
    std_extraction_per_logbook      = fields.Float(string='Std Dev Ekstraksi per Logbook', readonly=True)
    avg_extraction_per_student      = fields.Float(string='Rata-rata Ekstraksi per Mahasiswa', readonly=True)
    std_extraction_per_student      = fields.Float(string='Std Dev Ekstraksi per Mahasiswa', readonly=True)
    avg_extraction_per_student_week = fields.Float(string='Rata-rata Ekstraksi per Mahasiswa per Minggu', readonly=True)
    std_extraction_per_student_week = fields.Float(string='Std Dev Ekstraksi per Mahasiswa per Minggu', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
        CREATE OR REPLACE VIEW logbook_extraction_descriptive_stats AS (
            WITH 
            per_logbook AS (
                SELECT
                  COUNT(e.id) AS count_logbook
                FROM logbook_logbook lb
                LEFT JOIN logbook_extraction e 
                  ON e.logbook_id = lb.id
                 AND e.content IS NOT NULL
                 AND e.content != ''
                GROUP BY lb.id
            ),
            per_student AS (
                SELECT
                  COUNT(e.id) AS count_student
                FROM logbook_logbook lb
                LEFT JOIN logbook_extraction e 
                  ON e.logbook_id = lb.id
                 AND e.content IS NOT NULL
                 AND e.content != ''
                GROUP BY lb.student_id
            ),
            per_student_week AS (
                SELECT
                  COUNT(e.id) AS count_student_week
                FROM logbook_logbook lb
                LEFT JOIN logbook_extraction e 
                  ON e.logbook_id = lb.id
                 AND e.content IS NOT NULL
                 AND e.content != ''
                WHERE lb.week_id IS NOT NULL
                GROUP BY lb.student_id, lb.week_id
            )
            SELECT
              1 AS id,
              -- Agregasi CTE per_logbook
              (SELECT ROUND(AVG(count_logbook)::numeric, 2) 
               FROM per_logbook)             AS avg_extraction_per_logbook,
              (SELECT ROUND(STDDEV(count_logbook)::numeric, 2) 
               FROM per_logbook)             AS std_extraction_per_logbook,
              -- Agregasi CTE per_student
              (SELECT ROUND(AVG(count_student)::numeric, 2) 
               FROM per_student)             AS avg_extraction_per_student,
              (SELECT ROUND(STDDEV(count_student)::numeric, 2) 
               FROM per_student)             AS std_extraction_per_student,
              -- Agregasi CTE per_student_week
              (SELECT ROUND(AVG(count_student_week)::numeric, 2) 
               FROM per_student_week)        AS avg_extraction_per_student_week,
              (SELECT ROUND(STDDEV(count_student_week)::numeric, 2) 
               FROM per_student_week)        AS std_extraction_per_student_week
        );
        """)




class LogbookExtractionWeeklyByCategory(models.Model):
    _name = 'logbook.extraction.weekly.category'
    _auto = False
    _description = 'Tren Ekstraksi per Proyek per Minggu berdasarkan Kategori Label'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    week_id           = fields.Many2one('course.activity', string='Minggu', readonly=True) 
    week_start_date   = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date     = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label        = fields.Char(string='Label Minggu', readonly=True)
    category_id       = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    extraction_count  = fields.Integer(string='Jumlah Ekstraksi (poin ≠ 0)', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_category AS (
                SELECT
                    MIN(e.id)                                          AS id,
                    lb.project_course_id                              AS project_course_id,
                    lb.week_id                                        AS week_id,
                    w.start_date                                      AS week_start_date,
                    w.end_date                                        AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY')              AS week_label,
                    e.label_category_id                                AS category_id,
                    COUNT(e.id)                                       AS extraction_count
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON e.logbook_id = lb.id
                JOIN course_activity w ON lb.week_id = w.id AND w.type = 'week'
                WHERE
                    lb.project_course_id IS NOT NULL
                    AND e.content IS NOT NULL
                    AND e.content != ''
                    AND e.label_category_id IS NOT NULL
                GROUP BY
                    lb.project_course_id,
                    lb.week_id,
                    w.start_date,
                    w.end_date,
                    e.label_category_id
            )
        """)


class LogbookExtractionWeeklyBySubcategory(models.Model):
    _name = 'logbook.extraction.weekly.subcategory'
    _auto = False
    _description = 'Tren Ekstraksi per Proyek per Minggu berdasarkan Subkategori Label'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    week_id           = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date   = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date     = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label        = fields.Char(string='Label Minggu', readonly=True)
    subcategory_id    = fields.Many2one('logbook.label.sub.category', string='Subkategori Label', readonly=True)
    extraction_count  = fields.Integer(string='Jumlah Ekstraksi (poin ≠ 0)', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_subcategory AS (
                SELECT
                    MIN(e.id)                                            AS id,
                    lb.project_course_id                                AS project_course_id,
                    lb.week_id                                          AS week_id,
                    w.start_date                                        AS week_start_date,
                    w.end_date                                          AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY')                AS week_label,
                    e.label_sub_category_id                             AS subcategory_id,
                    COUNT(e.id)                                         AS extraction_count
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON e.logbook_id = lb.id
                JOIN course_activity w ON lb.week_id = w.id AND w.type = 'week'
                WHERE
                    lb.project_course_id IS NOT NULL
                    AND e.point IS NOT NULL
                    AND e.point <> 0
                    AND e.label_sub_category_id IS NOT NULL
                GROUP BY
                    lb.project_course_id,
                    lb.week_id,
                    w.start_date,
                    w.end_date,
                    e.label_sub_category_id
            )
        """)


class LogbookExtractionWeeklyBySubcategory(models.Model):
    _name = 'logbook.extraction.weekly.subcategory'
    _auto = False
    _description = 'Tren Ekstraksi per Minggu berdasarkan Label (Kategori > Subkategori)'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    week_id           = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date   = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date     = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label        = fields.Char(string='Label Minggu', readonly=True)

    # Kolom kategori & subkategori:
    category_id       = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    subcategory_id    = fields.Many2one('logbook.label.sub.category', string='Subkategori Label', readonly=True)

    extraction_count  = fields.Integer(string='Jumlah Ekstraksi (poin ≠ 0)', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        # CREATE VIEW: satu baris per (project, week, category, subcategory)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_subcategory AS (
                SELECT
                    row_number() OVER ()                                AS id,
                    lb.project_course_id                                AS project_course_id,
                    lb.week_id                                          AS week_id,
                    w.start_date                                        AS week_start_date,
                    w.end_date                                          AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY')                AS week_label,

                    e.label_category_id                                 AS category_id,
                    e.label_sub_category_id                             AS subcategory_id,
                    COUNT(e.id)                                         AS extraction_count

                FROM logbook_extraction e
                JOIN logbook_logbook lb ON lb.id = e.logbook_id
                JOIN course_activity w  ON w.id = lb.week_id AND w.type = 'week'
                WHERE lb.project_course_id      IS NOT NULL
                  AND e.label_category_id       IS NOT NULL
                  AND e.label_sub_category_id   IS NOT NULL
                  AND e.point        IS NOT NULL AND e.point <> 0
                GROUP BY
                    lb.project_course_id,
                    lb.week_id,
                    w.start_date, w.end_date,
                    e.label_category_id,
                    e.label_sub_category_id
            );
        """)


class LogbookExtractionWeeklyByLabel(models.Model):
    _name = 'logbook.extraction.weekly.label'
    _auto = False
    _description = 'Tren Ekstraksi per Minggu berdasarkan Label'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    week_id           = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date   = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date     = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label        = fields.Char(string='Label Minggu', readonly=True)
    label_id          = fields.Many2one('logbook.label', string='Label', readonly=True) # Asumsi ada model 'logbook.label'
    extraction_count  = fields.Integer(string='Jumlah Ekstraksi (poin ≠ 0)', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_label AS (
                SELECT
                    MIN(e.id) AS id,
                    lb.project_course_id AS project_course_id,
                    lb.week_id AS week_id,
                    w.start_date AS week_start_date,
                    w.end_date AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY') AS week_label,
                    e.label_id AS label_id,
                    COUNT(e.id) AS extraction_count
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON e.logbook_id = lb.id
                JOIN course_activity w ON lb.week_id = w.id AND w.type = 'week'
                WHERE
                    lb.project_course_id IS NOT NULL
                    AND e.point IS NOT NULL
                    AND e.point <> 0
                    AND e.label_id IS NOT NULL
                GROUP BY
                    lb.project_course_id,
                    lb.week_id,
                    w.start_date,
                    w.end_date,
                    e.label_id
            )
        """)