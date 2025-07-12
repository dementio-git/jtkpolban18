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

        
class LogbookExtractionDescriptiveStats(models.Model):
    _name = 'logbook.extraction.descriptive.stats'
    _auto = False
    _description = 'Statistik Deskriptif Ekstraksi Logbook'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    avg_extraction_per_logbook      = fields.Float(string='Rata-rata Ekstraksi per Logbook', readonly=True)
    std_extraction_per_logbook      = fields.Float(string='Std Dev Ekstraksi per Logbook', readonly=True)
    avg_extraction_per_student      = fields.Float(string='Rata-rata Ekstraksi per Mahasiswa', readonly=True)
    std_extraction_per_student      = fields.Float(string='Std Dev Ekstraksi per Mahasiswa', readonly=True)
    avg_extraction_per_student_week = fields.Float(string='Rata-rata Ekstraksi per Mahasiswa per Minggu', readonly=True)
    std_extraction_per_student_week = fields.Float(string='Std Dev Ekstraksi per Mahasiswa per Minggu', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""       
            CREATE OR REPLACE VIEW logbook_extraction_descriptive_stats AS
                WITH extraction_data AS (
                    SELECT
                        lb.project_course_id,
                        lb.id          AS logbook_id,
                        lb.student_id,
                        lb.week_id,
                        e.id           AS extraction_id
                    FROM logbook_logbook     lb
                    JOIN logbook_extraction  e  ON e.logbook_id = lb.id
                    WHERE e.content IS NOT NULL AND e.content <> ''
                ),

                -- 1 baris / project_course_id
                logbook_stats AS (
                    SELECT
                        project_course_id,
                        ROUND(AVG(cnt)::numeric,2)  AS avg_logbook,
                        ROUND(STDDEV(cnt)::numeric,2) AS std_logbook
                    FROM (
                        SELECT project_course_id, logbook_id, COUNT(*) AS cnt
                        FROM extraction_data
                        GROUP BY project_course_id, logbook_id
                    ) t GROUP BY project_course_id
                ),

                student_stats AS (
                    SELECT
                        project_course_id,
                        ROUND(AVG(cnt)::numeric,2)  AS avg_student,
                        ROUND(STDDEV(cnt)::numeric,2) AS std_student
                    FROM (
                        SELECT project_course_id, student_id, COUNT(*) AS cnt
                        FROM extraction_data
                        GROUP BY project_course_id, student_id
                    ) t GROUP BY project_course_id
                ),

                student_week_stats AS (
                    SELECT
                        project_course_id,
                        ROUND(AVG(cnt)::numeric,2)  AS avg_stu_week,
                        ROUND(STDDEV(cnt)::numeric,2) AS std_stu_week
                    FROM (
                        SELECT project_course_id, student_id, week_id, COUNT(*) AS cnt
                        FROM extraction_data
                        GROUP BY project_course_id, student_id, week_id
                    ) t GROUP BY project_course_id
                )

                SELECT
                    ROW_NUMBER() OVER ()                    AS id,
                    pc.project_course_id                    AS project_course_id,
                    ls.avg_logbook                          AS avg_extraction_per_logbook,
                    ls.std_logbook                          AS std_extraction_per_logbook,
                    ss.avg_student                          AS avg_extraction_per_student,
                    ss.std_student                          AS std_extraction_per_student,
                    sws.avg_stu_week                        AS avg_extraction_per_student_week,
                    sws.std_stu_week                        AS std_extraction_per_student_week
                FROM (
                    SELECT DISTINCT project_course_id FROM extraction_data
                ) pc
                LEFT JOIN logbook_stats      ls  ON ls.project_course_id  = pc.project_course_id
                LEFT JOIN student_stats      ss  ON ss.project_course_id  = pc.project_course_id
                LEFT JOIN student_week_stats sws ON sws.project_course_id = pc.project_course_id;

        """)
        
class LogbookWeeklyActivityProject(models.Model):
    _name = "logbook.weekly.activity"
    _auto = False
    _description = "Statistik Aktivitas Logbook per Project per Minggu"

    project_course_id = fields.Many2one("project.course", string="Mata Kuliah", readonly=True)
    week_id = fields.Many2one("course.activity", string="Minggu", readonly=True)
    week_start_date = fields.Date(string="Tanggal Mulai Minggu", readonly=True)
    week_end_date = fields.Date(string="Tanggal Akhir Minggu", readonly=True)
    week_label = fields.Char(string="Label Minggu", readonly=True)
    logbook_count = fields.Integer(string="Jumlah Logbook", readonly=True)
    extraction_count = fields.Integer(string="Jumlah Ekstraksi", readonly=True)
    extraction_ratio = fields.Float(string="Rasio Ekstraksi/Logbook", readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
        CREATE OR REPLACE VIEW logbook_weekly_activity AS
        WITH 
        distinct_weeks AS (
            SELECT
                lb.project_course_id,
                lb.week_id,
                w.start_date,
                w.end_date,
                DENSE_RANK() OVER (
                    PARTITION BY lb.project_course_id
                    ORDER BY w.start_date
                ) AS week_num
            FROM logbook_logbook lb
            JOIN course_activity w ON w.id = lb.week_id AND w.type = 'week'
            WHERE lb.project_course_id IS NOT NULL
            GROUP BY
                lb.project_course_id,
                lb.week_id,
                w.start_date,
                w.end_date
        ),
        logbook_stats AS (
            SELECT 
                lb.project_course_id,
                lb.week_id,
                COUNT(DISTINCT lb.id) as logbook_count
            FROM logbook_logbook lb
            GROUP BY lb.project_course_id, lb.week_id
        ),
        extraction_stats AS (
            SELECT
                lb.project_course_id,
                lb.week_id,
                COUNT(e.id) as extraction_count
            FROM logbook_extraction e
            JOIN logbook_logbook lb ON e.logbook_id = lb.id
            WHERE e.content IS NOT NULL AND e.content <> ''
            GROUP BY lb.project_course_id, lb.week_id
        )
        SELECT
            ROW_NUMBER() OVER () AS id,
            dw.project_course_id,
            dw.week_id,
            dw.start_date AS week_start_date,
            dw.end_date AS week_end_date,
            CONCAT('W', dw.week_num) AS week_label,
            COALESCE(ls.logbook_count, 0) as logbook_count,
            COALESCE(es.extraction_count, 0) as extraction_count,
            CASE 
                WHEN COALESCE(ls.logbook_count, 0) = 0 THEN 0
                ELSE ROUND((COALESCE(es.extraction_count, 0)::numeric / 
                          ls.logbook_count::numeric)::numeric, 2)
            END as extraction_ratio
        FROM distinct_weeks dw
        LEFT JOIN logbook_stats ls ON ls.project_course_id = dw.project_course_id
                                 AND ls.week_id = dw.week_id
        LEFT JOIN extraction_stats es ON es.project_course_id = dw.project_course_id
                                    AND es.week_id = dw.week_id
        ORDER BY
            dw.project_course_id,
            dw.week_num
        """)

class LogbookExtractionWeeklyByCategory(models.Model):
    _name = 'logbook.extraction.weekly.category'
    _auto = False
    _description = 'Tren Ekstraksi per Proyek per Minggu berdasarkan Kategori Label'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    week_id = fields.Many2one('course.activity', string='Minggu', readonly=True) 
    week_start_date = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label = fields.Char(string='Label Minggu', readonly=True)
    category_id = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    extraction_count = fields.Integer(string='Jumlah Ekstraksi', readonly=True)
    avg_norm_point = fields.Float(string='Rata-rata Point Ternormalisasi', digits=(16,2), readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_category AS (
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
                    MIN(e.id) AS id,
                    lb.project_course_id AS project_course_id,
                    lb.week_id AS week_id,
                    w.start_date AS week_start_date,
                    w.end_date AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY') AS week_label,
                    e.label_category_id AS category_id,
                    COUNT(e.id) AS extraction_count,
                    ROUND(
                        AVG(
                            CASE
                                WHEN pr.min_point = pr.max_point THEN 0
                                ELSE (e.point - pr.min_point)::numeric / 
                                     NULLIF(pr.max_point - pr.min_point, 0)
                            END
                        )::numeric, 
                    2) AS avg_norm_point
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON lb.id = e.logbook_id
                JOIN course_activity w ON lb.week_id = w.id AND w.type = 'week'
                LEFT JOIN point_rules pr ON pr.category_id = e.label_category_id
                WHERE
                    lb.project_course_id IS NOT NULL
                    AND e.content IS NOT NULL
                    AND e.content != ''
                    AND e.label_category_id IS NOT NULL
                    AND e.point IS NOT NULL
                    AND e.point BETWEEN COALESCE(pr.min_point, e.point) 
                                  AND COALESCE(pr.max_point, e.point)
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
    _description = 'Tren Ekstraksi per Minggu berdasarkan Label (Kategori > Subkategori)'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    week_id           = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date   = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date     = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label        = fields.Char(string='Label Minggu', readonly=True)
    category_id       = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    subcategory_id    = fields.Many2one('logbook.label.sub.category', string='Subkategori Label', readonly=True)
    extraction_count  = fields.Integer(string='Jumlah Ekstraksi', readonly=True)
    avg_norm_point    = fields.Float(string='Rata-rata Point Ternormalisasi', digits=(16,2), readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_subcategory AS (
                WITH point_rules AS (
                    SELECT 
                        l.category_id,
                        l.sub_category_id,
                        MIN(lr.point) as min_point,
                        MAX(lr.point) as max_point
                    FROM logbook_label l
                    JOIN logbook_label_point_rule lr ON lr.label_id = l.id
                    GROUP BY l.category_id, l.sub_category_id
                )
                SELECT
                    row_number() OVER ()                                AS id,
                    lb.project_course_id                                AS project_course_id,
                    lb.week_id                                          AS week_id,
                    w.start_date                                        AS week_start_date,
                    w.end_date                                          AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY')                AS week_label,
                    e.label_category_id                                 AS category_id,
                    e.label_sub_category_id                             AS subcategory_id,
                    COUNT(e.id)                                         AS extraction_count,
                    ROUND(
                        AVG(
                            CASE
                                WHEN pr.min_point = pr.max_point THEN 0
                                ELSE (e.point - pr.min_point)::numeric / 
                                     NULLIF(pr.max_point - pr.min_point, 0)
                            END
                        )::numeric, 
                    2)                                                  AS avg_norm_point
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON lb.id = e.logbook_id
                JOIN course_activity w  ON w.id = lb.week_id AND w.type = 'week'
                LEFT JOIN point_rules pr ON pr.category_id = e.label_category_id 
                                      AND pr.sub_category_id = e.label_sub_category_id
                WHERE lb.project_course_id      IS NOT NULL
                  AND e.label_category_id       IS NOT NULL
                  AND e.label_sub_category_id   IS NOT NULL
                  AND e.content IS NOT NULL
                  AND e.content != ''
                  AND e.point IS NOT NULL
                  AND e.point BETWEEN COALESCE(pr.min_point, e.point) 
                                AND COALESCE(pr.max_point, e.point)
                GROUP BY
                    lb.project_course_id,
                    lb.week_id,
                    w.start_date, 
                    w.end_date,
                    e.label_category_id,
                    e.label_sub_category_id
            );
        """)
        
class LogbookExtractionWeeklyByLabel(models.Model):
    _name = 'logbook.extraction.weekly.label'
    _auto = False
    _description = 'Tren Ekstraksi per Minggu berdasarkan Label (dengan Kategori dan Subkategori)'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
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
            CREATE OR REPLACE VIEW logbook_extraction_weekly_label AS (
                SELECT
                    -- Menggunakan row_number() untuk ID unik, seperti di model 'logbook.extraction.weekly.subcategory'
                    row_number() OVER () AS id, 
                    lb.project_course_id AS project_course_id,
                    lb.week_id AS week_id,
                    w.start_date AS week_start_date,
                    w.end_date AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY') AS week_label,
                    e.label_id AS label_id,
                    -- Menambahkan category_id dan subcategory_id dari logbook_extraction
                    e.label_category_id AS category_id,
                    e.label_sub_category_id AS subcategory_id,
                    COUNT(e.id) AS extraction_count
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON e.logbook_id = lb.id
                JOIN course_activity w ON lb.week_id = w.id AND w.type = 'week'
                WHERE
                    lb.project_course_id IS NOT NULL
                    AND e.content IS NOT NULL
                    AND e.content != ''
                    AND e.label_id IS NOT NULL
                    -- Hanya sertakan jika kategori dan subkategori juga tidak NULL
                    AND e.label_category_id IS NOT NULL
                GROUP BY
                    lb.project_course_id,
                    lb.week_id,
                    w.start_date,
                    w.end_date,
                    e.label_id,
                    e.label_category_id,
                    e.label_sub_category_id
            )
        """)
                
class LogbookExtractionWeeklyLabelNorm(models.Model):
    _name = 'logbook.extraction.weekly.label.norm'
    _auto = False
    _description = 'Rata-Rata Point Ternormalisasi per Minggu & Label (filter content & range)'

    project_course_id = fields.Many2one(
        'project.course', string='Mata Kuliah', readonly=True)
    week_id = fields.Many2one(
        'course.activity', string='Minggu', readonly=True)
    week_start_date = fields.Date(
        string='Tanggal Mulai Minggu', readonly=True)
    week_end_date = fields.Date(
        string='Tanggal Akhir Minggu', readonly=True)
    week_label = fields.Char(
        string='Label Minggu', readonly=True)

    label_id = fields.Many2one(
        'logbook.label', string='Label', readonly=True)
    category_id = fields.Many2one(
        'logbook.label.category', string='Kategori Label', readonly=True)
    subcategory_id = fields.Many2one(
        'logbook.label.sub.category', string='Subkategori Label', readonly=True)

    avg_norm_point = fields.Float(
        string='AVG Point Ternormalisasi',
        digits=(16, 2),
        readonly=True,
    )

    def init(self):
        tools.drop_view_if_exists(self._cr, self._table)
        self._cr.execute("""
            CREATE OR REPLACE VIEW %(table)s AS (
                SELECT
                    row_number() OVER ()                                        AS id,

                    /* Dimensi */
                    lb.project_course_id                                        AS project_course_id,
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
                    lb.week_id,
                    w.start_date,
                    w.end_date,
                    e.label_id,
                    e.label_category_id,
                    e.label_sub_category_id
            )
        """ % {'table': self._table})
 
class LogbookKeywordCloud(models.Model):
    _name = 'logbook.keyword.cloud'
    _auto = False
    _description = 'WordCloud Keyword Logbook per Minggu dengan Persentase dan Peringkat'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    week_id           = fields.Many2one('course.activity', string='Minggu', readonly=True)
    class_id          = fields.Many2one('class.class', string='Kelas', readonly=True)
    keyword           = fields.Char(string='Keyword', readonly=True)
    frequency         = fields.Integer(string='Frekuensi', readonly=True)
    freq_pct_week     = fields.Float(string='Persentase Mingguan (%)', readonly=True)
    freq_rank_week    = fields.Integer(string='Peringkat Mingguan', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_keyword_cloud AS (
                WITH KeywordStats AS (
                    SELECT 
                        l.project_course_id,
                        l.week_id,
                        s.class_id,
                        k.name      AS keyword,
                        COUNT(*)    AS frequency
                    FROM logbook_logbook l
                    JOIN student_student s ON l.student_id = s.id
                    JOIN logbook_keyword k ON k.logbook_id = l.id
                    WHERE l.project_course_id IS NOT NULL
                    GROUP BY l.project_course_id, l.week_id, s.class_id, k.name
                ),
                TotalFreq AS (
                    SELECT
                        project_course_id,
                        week_id,
                        class_id,
                        SUM(frequency) AS total_freq
                    FROM KeywordStats
                    GROUP BY project_course_id, week_id, class_id
                )
                SELECT
                    ROW_NUMBER() OVER ()                                         AS id,
                    ks.project_course_id,
                    ks.week_id,
                    ks.class_id,
                    ks.keyword,
                    ks.frequency,
                    ROUND(ks.frequency::numeric / tf.total_freq * 100, 2)        AS freq_pct_week,
                    DENSE_RANK() OVER (
                        PARTITION BY ks.project_course_id, ks.week_id, ks.class_id
                        ORDER BY ks.frequency DESC
                    )                                                              AS freq_rank_week
                FROM KeywordStats ks
                JOIN TotalFreq tf ON
                    tf.project_course_id = ks.project_course_id AND
                    tf.week_id           = ks.week_id           AND
                    tf.class_id          = ks.class_id
            )
        """)
                
class LogbookKeywordCloudOverall(models.Model):
    _name = 'logbook.keyword.cloud.overall'
    _auto = False
    _description = 'WordCloud Keyword Logbook Overall dengan Persentase dan Peringkat'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    class_id          = fields.Many2one('class.class', string='Kelas', readonly=True)
    keyword           = fields.Char(string='Keyword', readonly=True)
    frequency         = fields.Integer(string='Frekuensi', readonly=True)
    freq_pct_overall  = fields.Float(string='Persentase Overall (%)', readonly=True)
    freq_rank_overall = fields.Integer(string='Peringkat Overall', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_keyword_cloud_overall AS (
                WITH KeywordStats AS (
                    SELECT 
                        l.project_course_id,
                        s.class_id,
                        k.name      AS keyword,
                        COUNT(*)    AS frequency
                    FROM logbook_logbook l
                    JOIN student_student s ON l.student_id = s.id
                    JOIN logbook_keyword k ON k.logbook_id = l.id
                    WHERE l.project_course_id IS NOT NULL
                    GROUP BY l.project_course_id, s.class_id, k.name
                ),
                TotalFreqAll AS (
                    SELECT
                        project_course_id,
                        class_id,
                        SUM(frequency) AS total_freq
                    FROM KeywordStats
                    GROUP BY project_course_id, class_id
                )
                SELECT
                    ROW_NUMBER() OVER ()                                          AS id,
                    ks.project_course_id,
                    ks.class_id,
                    ks.keyword,
                    ks.frequency,
                    ROUND(ks.frequency::numeric / tfa.total_freq * 100, 2)       AS freq_pct_overall,
                    DENSE_RANK() OVER (
                        PARTITION BY ks.project_course_id, ks.class_id
                        ORDER BY ks.frequency DESC
                    )                                                              AS freq_rank_overall
                FROM KeywordStats ks
                JOIN TotalFreqAll tfa ON
                    tfa.project_course_id = ks.project_course_id AND
                    tfa.class_id          = ks.class_id
            )
        """)
        