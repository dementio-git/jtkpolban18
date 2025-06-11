# logbook_class_analytics.py
from odoo import models, fields, tools

class LogbookDescriptiveStatsClass(models.Model):
    _name = 'logbook.descriptive.stats.class'
    _auto = False
    _description = 'Statistik Deskriptif Logbook per Kelas'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    class_id = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name = fields.Char(string='Nama Kelas', readonly=True)
    total_students = fields.Integer(string='Total Mahasiswa')
    total_logbooks = fields.Integer(string='Total Logbook')
    avg_logbooks_per_week = fields.Float(string='Rata-rata Logbook/Minggu')
    std_dev_logbooks = fields.Float(string='Std Dev Logbook/Minggu')
    avg_active_students_per_week = fields.Float(string='Rata-rata Mahasiswa Aktif/Minggu')
    std_dev_active_students_per_week = fields.Float(string='Std Dev Mahasiswa Aktif/Minggu')
    avg_logbooks_per_student_week = fields.Float(string='Rata-rata Logbook/Mahasiswa/Minggu')
    std_dev_logbooks_per_student_week = fields.Float(string='Std Dev Logbook/Mahasiswa/Minggu')

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_descriptive_stats_class AS (
                WITH enrolled AS (
                    SELECT 
                        s.class_id,
                        COUNT(DISTINCT s.id) AS total_students
                    FROM student_student s
                    WHERE s.class_id IS NOT NULL
                    GROUP BY s.class_id
                ),
                weekly_stats AS (
                    SELECT
                        class_id,
                        week_id,
                        COUNT(*) AS total_logbooks,
                        COUNT(DISTINCT student_id) AS active_students
                    FROM logbook_count
                    WHERE class_id IS NOT NULL AND week_id IS NOT NULL
                    GROUP BY class_id, week_id
                ),
                weekly_avg_per_student AS (
                    SELECT
                        class_id,
                        week_id,
                        SUM(logbook_count)::float / NULLIF(COUNT(student_id), 0) AS avg_logbooks_per_student_week
                    FROM (
                        SELECT
                            l.student_id,
                            s.class_id,
                            l.week_id,
                            COUNT(*) AS logbook_count
                        FROM logbook_logbook l
                        JOIN student_student s ON s.id = l.student_id
                        WHERE s.class_id IS NOT NULL AND l.week_id IS NOT NULL
                        GROUP BY l.student_id, s.class_id, l.week_id
                    ) sub
                    GROUP BY class_id, week_id
                )

                SELECT
                    ROW_NUMBER() OVER () AS id,
                    pc.id AS project_course_id,
                    c.id AS class_id,
                    c.name AS class_name,
                    COALESCE(e.total_students, 0) AS total_students,
                    COALESCE(t.total_logbooks, 0) AS total_logbooks,
                    ROUND(AVG(w.total_logbooks)::numeric, 2) AS avg_logbooks_per_week,
                    ROUND(STDDEV(w.total_logbooks)::numeric, 2) AS std_dev_logbooks,
                    ROUND(AVG(w.active_students)::numeric, 2) AS avg_active_students_per_week,
                    ROUND(STDDEV(w.active_students)::numeric, 2) AS std_dev_active_students_per_week,
                    ROUND(AVG(waps.avg_logbooks_per_student_week)::numeric, 2) AS avg_logbooks_per_student_week,
                    ROUND(STDDEV(waps.avg_logbooks_per_student_week)::numeric, 2) AS std_dev_logbooks_per_student_week
                FROM class_class c
                JOIN class_class_project_course_rel rel ON rel.class_class_id = c.id
                JOIN project_course pc ON pc.id = rel.project_course_id
                LEFT JOIN enrolled e ON e.class_id = c.id
                LEFT JOIN (
                    SELECT class_id, COUNT(*) AS total_logbooks
                    FROM logbook_count
                    GROUP BY class_id
                ) t ON t.class_id = c.id
                LEFT JOIN weekly_stats w ON w.class_id = c.id
                LEFT JOIN weekly_avg_per_student waps ON waps.class_id = c.id
                GROUP BY c.id, c.name, pc.id, e.total_students, t.total_logbooks
            );
        """)
        
        
class LogbookWeeklyStatsClass(models.Model):
    _name = 'logbook.weekly.stats.class'
    _auto = False
    _description = 'Statistik Per Minggu per Kelas'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    class_id           = fields.Many2one('class.class',        string='Kelas',           readonly=True)
    class_name         = fields.Char(                          string='Nama Kelas',     readonly=True)
    week_id            = fields.Many2one('course.activity',    string='Minggu',          readonly=True)
    week_start_date    = fields.Date(                          string='Tanggal Mulai Minggu', readonly=True)
    week_end_date      = fields.Date(                          string='Tanggal Akhir Minggu', readonly=True)
    avg_logbooks_per_week           = fields.Float(string='Rata-rata Logbook/Minggu',              readonly=True)
    avg_active_students_per_week    = fields.Float(string='Rata-rata Mahasiswa Aktif/Minggu', readonly=True)
    avg_logbooks_per_student_week   = fields.Float(string='Rata-rata Logbook/Mahasiswa/Minggu', readonly=True)
    week_label                     = fields.Char( string='Label Minggu', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
        CREATE OR REPLACE VIEW logbook_weekly_stats_class AS
        WITH

          distinct_weeks AS (
            SELECT
              rel.project_course_id,
              w.id          AS week_id,
              w.start_date,
              w.end_date,
              DENSE_RANK() OVER (
                PARTITION BY rel.project_course_id
                ORDER BY w.start_date
              ) AS week_num
            FROM class_class_project_course_rel rel
            JOIN course_activity w
              ON w.type = 'week'
            WHERE EXISTS (
              SELECT 1
              FROM logbook_logbook l
              WHERE l.project_course_id = rel.project_course_id
                AND l.week_id          = w.id
            )
            GROUP BY rel.project_course_id, w.id, w.start_date, w.end_date
          ),


          logbook_counts AS (
            SELECT
              l.student_id,
              s.class_id,
              l.project_course_id,
              l.week_id,
              COUNT(*) AS logbook_count
            FROM logbook_logbook l
            JOIN student_student s ON s.id = l.student_id
            GROUP BY l.student_id, s.class_id, l.project_course_id, l.week_id
          ),


          student_weeks AS (
            SELECT
              l.student_id,
              s.class_id,
              l.project_course_id,
              l.week_id
            FROM logbook_logbook l
            JOIN student_student s ON s.id = l.student_id
            GROUP BY l.student_id, s.class_id, l.project_course_id, l.week_id
          )

        SELECT
          ROW_NUMBER() OVER ()                                    AS id,
          sw.project_course_id,
          sw.class_id,
          c.name                                                  AS class_name,
          sw.week_id,
          dw.start_date                                           AS week_start_date,
          dw.end_date                                             AS week_end_date,
          CONCAT('W', dw.week_num)                                AS week_label,
          SUM(COALESCE(lc.logbook_count, 0))::float               AS avg_logbooks_per_week,
          COUNT(DISTINCT CASE WHEN lc.logbook_count IS NOT NULL
                              THEN sw.student_id END)::float      AS avg_active_students_per_week,
          (SUM(COALESCE(lc.logbook_count, 0))::float
            / NULLIF(COUNT(sw.student_id), 0))::float             AS avg_logbooks_per_student_week
        FROM student_weeks sw
        JOIN class_class c ON c.id = sw.class_id
        JOIN distinct_weeks dw
          ON dw.project_course_id = sw.project_course_id
         AND dw.week_id           = sw.week_id
        LEFT JOIN logbook_counts lc
          ON lc.student_id = sw.student_id
         AND lc.class_id   = sw.class_id
         AND lc.week_id    = sw.week_id
        GROUP BY
          sw.project_course_id, sw.class_id, c.name,
          sw.week_id, dw.start_date, dw.end_date, dw.week_num
        ORDER BY sw.project_course_id, dw.week_num;
        """)

class LogbookWeeklyActivityClass(models.Model):
    _name = "logbook.weekly.activity.class"
    _auto = False
    _description = "Statistik Aktivitas Logbook per Kelas per Minggu"

    project_course_id = fields.Many2one("project.course", string="Mata Kuliah", readonly=True)
    class_id = fields.Many2one("class.class", string="Kelas", readonly=True)
    class_name = fields.Char(string="Nama Kelas", readonly=True)
    week_id = fields.Many2one("course.activity", string="Minggu", readonly=True)
    week_start_date = fields.Date(string="Tanggal Mulai Minggu", readonly=True)
    week_end_date = fields.Date(string="Tanggal Akhir Minggu", readonly=True)
    week_label = fields.Char(string="Label Minggu", readonly=True)
      # Stats dari LogbookWeeklyStatsClass
    logbook_count = fields.Integer(string="Jumlah Logbook", readonly=True)
    
    # Stats dari LogbookExtractionWeeklyClass
    extraction_count = fields.Integer(string="Jumlah Ekstraksi", readonly=True)
    extraction_ratio = fields.Float(string="Rasio Ekstraksi/Logbook", readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
        CREATE OR REPLACE VIEW logbook_weekly_activity_class AS
        WITH 
        distinct_weeks AS (
            SELECT
                rel.project_course_id,
                s.class_id,
                w.id AS week_id,
                w.start_date,
                w.end_date,
                DENSE_RANK() OVER (
                    PARTITION BY rel.project_course_id, s.class_id
                    ORDER BY w.start_date
                ) AS week_num
            FROM class_class_project_course_rel rel
            JOIN course_activity w ON w.type = 'week'
            JOIN logbook_logbook lb ON lb.project_course_id = rel.project_course_id
                                  AND lb.week_id = w.id
            JOIN student_student s ON s.id = lb.student_id
            GROUP BY
                rel.project_course_id, s.class_id,
                w.id, w.start_date, w.end_date
        ),
        logbook_stats AS (
            SELECT 
                lb.project_course_id,
                s.class_id,
                lb.week_id,
                COUNT(DISTINCT lb.id) as logbook_count,
                COUNT(DISTINCT lb.student_id) as active_students,                ROUND((COUNT(DISTINCT lb.id)::numeric / 
                      NULLIF(COUNT(DISTINCT lb.student_id), 0)::numeric)::numeric, 2) as avg_logbooks_per_student
            FROM logbook_logbook lb
            JOIN student_student s ON s.id = lb.student_id
            GROUP BY lb.project_course_id, s.class_id, lb.week_id
        ),
        extraction_stats AS (
            SELECT
                lb.project_course_id,
                s.class_id,
                lb.week_id,
                COUNT(e.id) as extraction_count
            FROM logbook_extraction e
            JOIN logbook_logbook lb ON e.logbook_id = lb.id
            JOIN student_student s ON s.id = lb.student_id
            WHERE e.content IS NOT NULL AND e.content <> ''
            GROUP BY lb.project_course_id, s.class_id, lb.week_id
        )
        SELECT
            ROW_NUMBER() OVER () AS id,
            dw.project_course_id,
            dw.class_id,
            c.name AS class_name,
            dw.week_id,
            dw.start_date AS week_start_date,
            dw.end_date AS week_end_date,
            CONCAT('W', dw.week_num) AS week_label,
            COALESCE(ls.logbook_count, 0) as logbook_count,
            COALESCE(ls.active_students, 0) as active_students,
            COALESCE(ls.avg_logbooks_per_student, 0) as avg_logbooks_per_student,
            COALESCE(es.extraction_count, 0) as extraction_count,
            CASE 
                WHEN COALESCE(ls.logbook_count, 0) = 0 THEN 0                ELSE ROUND((COALESCE(es.extraction_count, 0)::numeric / 
                          ls.logbook_count::numeric)::numeric, 2)
            END as extraction_ratio
        FROM distinct_weeks dw
        JOIN class_class c ON c.id = dw.class_id
        LEFT JOIN logbook_stats ls ON ls.project_course_id = dw.project_course_id
                                 AND ls.class_id = dw.class_id
                                 AND ls.week_id = dw.week_id
        LEFT JOIN extraction_stats es ON es.project_course_id = dw.project_course_id
                                    AND es.class_id = dw.class_id
                                    AND es.week_id = dw.week_id
        ORDER BY
            dw.project_course_id,
            dw.class_id,
            dw.week_num;
        """)
class LogbookExtractionDescriptiveStatsClass(models.Model):
    _name = "logbook.extraction.descriptive.stats.class"
    _auto = False
    _description = "Statistik Deskriptif Ekstraksi Logbook per Kelas"

    # ──────── DIMENSIONS ────────────────────────────────────────
    project_course_id                  = fields.Many2one(
        "project.course", string="Mata Kuliah", readonly=True
    )
    class_id                           = fields.Many2one(
        "class.class", string="Kelas", readonly=True
    )
    class_name                         = fields.Char(
        string="Nama Kelas", readonly=True
    )

    # ──────── METRICS ───────────────────────────────────────────
    total_extraction                   = fields.Integer(
        string="Total Ekstraksi", readonly=True
    )
    avg_extraction_per_logbook         = fields.Float(
        string="Rata-rata Ekstraksi per Logbook", readonly=True
    )
    std_extraction_per_logbook         = fields.Float(
        string="Std Dev Ekstraksi per Logbook", readonly=True
    )
    avg_extraction_per_student         = fields.Float(
        string="Rata-rata Ekstraksi per Mahasiswa", readonly=True
    )
    std_extraction_per_student         = fields.Float(
        string="Std Dev Ekstraksi per Mahasiswa", readonly=True
    )
    avg_extraction_per_student_week    = fields.Float(
        string="Rata-rata Ekstraksi per Mahasiswa per Minggu", readonly=True
    )
    std_extraction_per_student_week    = fields.Float(
        string="Std Dev Ekstraksi per Mahasiswa per Minggu", readonly=True
    )

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
        --------------------------------------------------------------------------------
        -- VIEW: logbook_extraction_descriptive_stats_class
        --------------------------------------------------------------------------------
        CREATE OR REPLACE VIEW logbook_extraction_descriptive_stats_class AS
        WITH
        /* ❶ Kumpulkan semua ekstraksi yang memiliki konten (≠ '') */
        extraction_data AS (
            SELECT
                e.id                    AS extraction_id,
                lb.project_course_id    AS project_course_id,
                s.class_id              AS class_id,
                lb.student_id           AS student_id,
                lb.week_id              AS week_id,
                lb.id                   AS logbook_id
            FROM logbook_extraction e
            JOIN logbook_logbook lb  ON lb.id = e.logbook_id
            JOIN student_student s   ON s.id  = lb.student_id
            WHERE
                e.content IS NOT NULL
                AND e.content <> ''
        ),

        /* ❷ Hitung jumlah ekstraksi per logbook (unique combination student + week + class) */
        per_logbook AS (
            SELECT
                ed.project_course_id,
                ed.class_id,
                ed.logbook_id,
                COUNT(ed.extraction_id)  AS cnt_per_logbook
            FROM extraction_data ed
            GROUP BY
                ed.project_course_id,
                ed.class_id,
                ed.logbook_id
        ),

        /* ❸ Hitung jumlah ekstraksi per mahasiswa (dalam satu kelas) */
        per_student AS (
            SELECT
                ed.project_course_id,
                ed.class_id,
                ed.student_id,
                COUNT(ed.extraction_id)  AS cnt_per_student
            FROM extraction_data ed
            GROUP BY
                ed.project_course_id,
                ed.class_id,
                ed.student_id
        ),

        /* ❹ Hitung jumlah minggu aktif per mahasiswa (distinct week_id) */
        student_weeks AS (
            SELECT
                ed.project_course_id,
                ed.class_id,
                ed.student_id,
                COUNT(DISTINCT ed.week_id)  AS weeks_cnt
            FROM extraction_data ed
            GROUP BY
                ed.project_course_id,
                ed.class_id,
                ed.student_id
        ),

        /* ❺ Hitung rasio ekstraksi per mahasiswa per minggu */
        ratio_mhs_minggu AS (
            SELECT
                ps.project_course_id,
                ps.class_id,
                ps.student_id,
                (ps.cnt_per_student::float / NULLIF(sw.weeks_cnt, 0))  AS ratio_per_student_week
            FROM per_student ps
            JOIN student_weeks sw
              ON sw.project_course_id = ps.project_course_id
             AND sw.class_id         = ps.class_id
             AND sw.student_id       = ps.student_id
        ),

        /* ❻ Hitung total ekstraksi per (project_course, class) */
        total_per_class AS (
            SELECT
                ed.project_course_id,
                ed.class_id,
                COUNT(ed.extraction_id)  AS total_extraction
            FROM extraction_data ed
            GROUP BY
                ed.project_course_id,
                ed.class_id
        )

        /* ───────── Final aggregation ────────────────────────────────────────────────── */
        SELECT
            ROW_NUMBER() OVER ()                                   AS id,
            tpc.project_course_id,
            tpc.class_id,
            c.name                                                 AS class_name,
            tpc.total_extraction,

            /* Rata-rata & StdDev per logbook */
            ROUND(AVG(pl.cnt_per_logbook)::numeric, 2)             AS avg_extraction_per_logbook,
            ROUND(STDDEV(pl.cnt_per_logbook)::numeric, 2)          AS std_extraction_per_logbook,

            /* Rata-rata & StdDev per mahasiswa */
            ROUND(AVG(ps.cnt_per_student)::numeric, 2)             AS avg_extraction_per_student,
            ROUND(STDDEV(ps.cnt_per_student)::numeric, 2)          AS std_extraction_per_student,

            /* Rata-rata & StdDev rasio mahasiswa-per-minggu */
            ROUND(AVG(rm.ratio_per_student_week)::numeric, 2)      AS avg_extraction_per_student_week,
            ROUND(STDDEV(rm.ratio_per_student_week)::numeric, 2)   AS std_extraction_per_student_week

        FROM total_per_class tpc
        LEFT JOIN per_logbook            pl  ON pl.project_course_id = tpc.project_course_id
                                              AND pl.class_id           = tpc.class_id
        LEFT JOIN per_student            ps  ON ps.project_course_id = tpc.project_course_id
                                              AND ps.class_id           = tpc.class_id
        LEFT JOIN ratio_mhs_minggu       rm  ON rm.project_course_id = tpc.project_course_id
                                              AND rm.class_id           = tpc.class_id
        JOIN class_class                  c   ON c.id = tpc.class_id
        GROUP BY
            tpc.project_course_id,
            tpc.class_id,
            c.name,
            tpc.total_extraction;
        """)
        
class LogbookExtractionWeeklyCategoryClass(models.Model):
    _name = 'logbook.extraction.weekly.category.class'
    _auto = False
    _description = 'Tren Ekstraksi per Kategori per Kelas per Minggu'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    class_id          = fields.Many2one('class.class',    string='Kelas',           readonly=True)
    class_name        = fields.Char(                     string='Nama Kelas',      readonly=True)
    week_id           = fields.Many2one('course.activity', string='Minggu',        readonly=True)
    week_start_date   = fields.Date(                      string='Tanggal Mulai Minggu', readonly=True)
    week_end_date     = fields.Date(                      string='Tanggal Akhir Minggu', readonly=True)
    week_label        = fields.Char(                      string='Label Minggu',    readonly=True)
    category_id       = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    extraction_count = fields.Integer(string='Jumlah Ekstraksi', readonly=True)
    avg_norm_point = fields.Float(string='Rata-rata Point Ternormalisasi', digits=(16,2), readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_category_class AS (
                WITH point_rules AS (
                    SELECT 
                        l.category_id,
                        MIN(lr.point) as min_point,
                        MAX(lr.point) as max_point
                    FROM logbook_label l
                    JOIN logbook_label_point_rule lr ON lr.label_id = l.id
                    GROUP BY l.category_id
                )
                SELECT
                    ROW_NUMBER() OVER ()                                   AS id,
                    lb.project_course_id                                   AS project_course_id,
                    s.class_id                                             AS class_id,
                    c.name                                                 AS class_name,
                    lb.week_id                                             AS week_id,
                    w.start_date                                           AS week_start_date,
                    w.end_date                                             AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY')                   AS week_label,
                    e.label_category_id                                    AS category_id,
                    COUNT(e.id)                                            AS extraction_count,
                    /* Perhitungan rata-rata poin ternormalisasi */
                    ROUND(
                        AVG(
                            CASE
                                WHEN pr.min_point = pr.max_point THEN 0
                                ELSE (e.point - pr.min_point)::numeric / 
                                     NULLIF(pr.max_point - pr.min_point, 0)
                            END
                        )::numeric, 
                    2)                                                     AS avg_norm_point
                FROM logbook_extraction e
                JOIN logbook_logbook lb   ON lb.id = e.logbook_id
                JOIN student_student s    ON s.id  = lb.student_id
                JOIN class_class c        ON c.id  = s.class_id
                JOIN course_activity w    ON w.id  = lb.week_id
                                       AND w.type = 'week'
                LEFT JOIN point_rules pr  ON pr.category_id = e.label_category_id
                WHERE
                    lb.project_course_id    IS NOT NULL
                    AND e.content           IS NOT NULL
                    AND e.content <> ''
                    AND e.label_category_id IS NOT NULL
                    AND e.point             IS NOT NULL
                    AND e.point BETWEEN COALESCE(pr.min_point, e.point) 
                                  AND COALESCE(pr.max_point, e.point)
                GROUP BY
                    lb.project_course_id,
                    s.class_id,
                    c.name,
                    lb.week_id,
                    w.start_date,
                    w.end_date,
                    e.label_category_id
            )
        """)
        
class LogbookExtractionWeeklySubCategoryClass(models.Model):
    _name = 'logbook.extraction.weekly.subcategory.class'
    _auto = False
    _description = 'Tren Ekstraksi per Subkategori per Kelas per Minggu'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    class_id          = fields.Many2one('class.class', string='Kelas', readonly=True) 
    class_name        = fields.Char(string='Nama Kelas', readonly=True)
    week_id           = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date   = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date     = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label        = fields.Char(string='Label Minggu', readonly=True)
    category_id       = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    subcategory_id    = fields.Many2one('logbook.label.sub.category', string='Subkategori Label', readonly=True)
    extraction_count  = fields.Integer(string='Jumlah Ekstraksi (poin ≠ 0)', readonly=True)

    def init(self):
      tools.drop_view_if_exists(self.env.cr, self._table)
      self.env.cr.execute("""
        CREATE OR REPLACE VIEW logbook_extraction_weekly_subcategory_class AS (
          SELECT
            ROW_NUMBER() OVER ()                                   AS id,
            lb.project_course_id                                   AS project_course_id,
            s.class_id                                             AS class_id,
            c.name                                                 AS class_name,
            lb.week_id                                             AS week_id,
            w.start_date                                           AS week_start_date,
            w.end_date                                             AS week_end_date,
            to_char(w.start_date, 'DD Mon YYYY')                   AS week_label,
            e.label_category_id                                    AS category_id,
            e.label_sub_category_id                                AS subcategory_id,
            COUNT(e.id)                                            AS extraction_count
          FROM logbook_extraction e
          JOIN logbook_logbook lb   ON lb.id = e.logbook_id
          JOIN student_student s    ON s.id  = lb.student_id
          JOIN class_class c        ON c.id  = s.class_id
          JOIN course_activity w    ON w.id  = lb.week_id
                          AND w.type = 'week'
          WHERE
            lb.project_course_id      IS NOT NULL
            AND e.content             IS NOT NULL
            AND e.content <> ''
            AND e.label_category_id   IS NOT NULL
            AND e.label_sub_category_id IS NOT NULL
          GROUP BY
            lb.project_course_id,
            s.class_id,
            c.name,
            lb.week_id,
            w.start_date,
            w.end_date,
            e.label_category_id,
            e.label_sub_category_id
        )
      """)
      
      

class LogbookExtractionWeeklyLabelClass(models.Model):
    _name = 'logbook.extraction.weekly.label.class'
    _auto = False
    _description = 'Tren Ekstraksi per Label per Kelas per Minggu'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    class_id          = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name        = fields.Char(string='Nama Kelas', readonly=True)
    week_id           = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date   = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date     = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label        = fields.Char(string='Label Minggu', readonly=True)
    
    label_id          = fields.Many2one('logbook.label', string='Label', readonly=True)
    category_id       = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    subcategory_id    = fields.Many2one('logbook.label.sub.category', string='Subkategori Label', readonly=True)
    
    extraction_count  = fields.Integer(string='Jumlah Ekstraksi (poin ≠ 0)', readonly=True)

    def init(self):
      tools.drop_view_if_exists(self.env.cr, self._table)
      self.env.cr.execute("""
        CREATE OR REPLACE VIEW logbook_extraction_weekly_label_class AS (
          SELECT
            row_number() OVER () AS id,
            lb.project_course_id AS project_course_id,
            s.class_id AS class_id, 
            c.name AS class_name,
            lb.week_id AS week_id,
            w.start_date AS week_start_date,
            w.end_date AS week_end_date,
            to_char(w.start_date, 'DD Mon YYYY') AS week_label,
            e.label_id AS label_id,
            e.label_category_id AS category_id,
            e.label_sub_category_id AS subcategory_id,
            COUNT(e.id) AS extraction_count
          FROM logbook_extraction e
          JOIN logbook_logbook lb ON e.logbook_id = lb.id
          JOIN student_student s ON s.id = lb.student_id
          JOIN class_class c ON c.id = s.class_id
          JOIN course_activity w ON lb.week_id = w.id AND w.type = 'week'
          WHERE
            lb.project_course_id IS NOT NULL
            AND e.content IS NOT NULL
            AND e.content != ''
            AND e.label_id IS NOT NULL
            AND e.label_category_id IS NOT NULL
          GROUP BY
            lb.project_course_id,
            s.class_id,
            c.name, 
            lb.week_id,
            w.start_date,
            w.end_date,
            e.label_id,
            e.label_category_id,
            e.label_sub_category_id
        )
      """)
      
      
class LogbookExtractionWeeklyLabelNormClass(models.Model):
    _name = 'logbook.extraction.weekly.label.norm.class'
    _auto = False
    _description = 'Rata-Rata Point Ternormalisasi per Kelas per Minggu & Label'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    class_id = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name = fields.Char(string='Nama Kelas', readonly=True)
    week_id = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label = fields.Char(string='Label Minggu', readonly=True)

    label_id = fields.Many2one('logbook.label', string='Label', readonly=True)
    category_id = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    subcategory_id = fields.Many2one('logbook.label.sub.category', string='Subkategori Label', readonly=True)

    avg_norm_point = fields.Float(string='AVG Point Ternormalisasi', digits=(16, 2), readonly=True)

    def init(self):
      tools.drop_view_if_exists(self._cr, self._table)
      self._cr.execute("""
        CREATE OR REPLACE VIEW %(table)s AS (
          SELECT
            row_number() OVER ()                                        AS id,

            /* Dimensi */
            lb.project_course_id                                        AS project_course_id,
            s.class_id                                                  AS class_id,
            c.name                                                      AS class_name,
            lb.week_id                                                  AS week_id,
            w.start_date                                                AS week_start_date,
            w.end_date                                                  AS week_end_date,
            to_char(w.start_date, 'DD Mon YYYY')                         AS week_label,

            e.label_id                                                 AS label_id,
            e.label_category_id                                        AS category_id,
            e.label_sub_category_id                                    AS subcategory_id,

            /* Hitung min & max per label via subquery, lalu normalisasi point */
            AVG(
              CASE
                WHEN lr.min_point = lr.max_point THEN 0
                ELSE (e.point - lr.min_point)::numeric
                    / NULLIF(lr.max_point - lr.min_point, 0)
              END
            )                                                            AS avg_norm_point

          FROM logbook_extraction        e

          JOIN logbook_logbook           lb ON lb.id = e.logbook_id
          JOIN student_student           s  ON s.id = lb.student_id
          JOIN class_class               c  ON c.id = s.class_id
          JOIN course_activity           w  ON w.id = lb.week_id
                              AND w.type = 'week'

          /* Subquery untuk min/max per label */
          JOIN (
              SELECT
              label_id,
              MIN(point) AS min_point,
              MAX(point) AS max_point
              FROM logbook_label_point_rule
              GROUP BY label_id
          ) lr ON lr.label_id = e.label_id

          WHERE
            lb.project_course_id IS NOT NULL
            AND e.point            IS NOT NULL
            AND e.label_id         IS NOT NULL
            AND e.label_category_id IS NOT NULL
            /* 1) Filter: content tidak boleh NULL atau string kosong */
            AND e.content IS NOT NULL
            AND e.content <> ''
            /* 2) Filter: hanya ambil e.point yang ada di antara min_point dan max_point */
            AND e.point BETWEEN lr.min_point AND lr.max_point

          GROUP BY
            lb.project_course_id,
            s.class_id,
            c.name,
            lb.week_id,
            w.start_date,
            w.end_date,
            e.label_id,
            e.label_category_id,
            e.label_sub_category_id
        )
      """ % {'table': self._table})
      