# logbook_student_analytics.py

from odoo import models, fields, tools

class LogbookExtractionStudentLabelAggregate(models.Model):
    _name = "logbook.extraction.student.label.aggregate"
    _description = "Total Poin per Mahasiswa per Label"
    _auto = False

    student_id = fields.Many2one("student.student", string="Mahasiswa", readonly=True)
    student_name = fields.Char(string="Nama Mahasiswa", readonly=True)
    project_course_id = fields.Many2one("project.course", string="Mata Kuliah", readonly=True)  # ✅ Tambah ini
    label_id = fields.Many2one("logbook.label", string="Label", readonly=True)
    total_point = fields.Float(string="Total Poin", readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT
                    row_number() OVER () AS id,
                    lb.student_id,
                    s.name AS student_name,
                    lb.project_course_id,                     -- ✅ SELECT juga project_course_id
                    e.label_id,
                    SUM(e.point) AS total_point
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON lb.id = e.logbook_id
                JOIN student_student s ON s.id = lb.student_id
                WHERE e.label_id IS NOT NULL AND e.point IS NOT NULL
                GROUP BY lb.student_id, s.name, lb.project_course_id, e.label_id
            )
        """ % self._table)

class LogbookExtractionStudentLabelNorm(models.Model):
    _name = 'logbook.extraction.student.label.norm'
    _description = 'Rata-Rata Point Ternormalisasi per Mahasiswa & Label'
    _auto = False

    student_id = fields.Many2one('student.student', string='Mahasiswa', readonly=True)
    student_name = fields.Char(string='Nama Mahasiswa', readonly=True)
    class_id = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name = fields.Char(string='Nama Kelas', readonly=True)
    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)

    label_id = fields.Many2one('logbook.label', string='Label', readonly=True)
    category_id = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    subcategory_id = fields.Many2one('logbook.label.sub.category', string='Subkategori Label', readonly=True)

    avg_norm_point = fields.Float(string='AVG Point Ternormalisasi', digits=(16, 2), readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %(table)s AS (
                SELECT
                    row_number() OVER () AS id,

                    s.id AS student_id,
                    s.name AS student_name,
                    s.class_id AS class_id,
                    c.name AS class_name,
                    lb.project_course_id,

                    e.label_id,
                    e.label_category_id AS category_id,
                    e.label_sub_category_id AS subcategory_id,

                    AVG(
                        CASE
                            WHEN lr.min_point = lr.max_point THEN 0
                            ELSE (e.point - lr.min_point)::numeric
                                 / NULLIF(lr.max_point - lr.min_point, 0)
                        END
                    ) AS avg_norm_point

                FROM logbook_extraction e
                JOIN logbook_logbook lb ON lb.id = e.logbook_id
                JOIN student_student s ON s.id = lb.student_id
                JOIN class_class c ON c.id = s.class_id

                JOIN (
                    SELECT label_id, MIN(point) AS min_point, MAX(point) AS max_point
                    FROM logbook_label_point_rule
                    GROUP BY label_id
                ) lr ON lr.label_id = e.label_id

                WHERE
                    lb.project_course_id IS NOT NULL
                    AND e.point IS NOT NULL
                    AND e.label_id IS NOT NULL
                    AND e.label_category_id IS NOT NULL
                    AND e.content IS NOT NULL
                    AND e.content <> ''
                    AND e.point BETWEEN lr.min_point AND lr.max_point

                GROUP BY
                    s.id, s.name, s.class_id, c.name,
                    lb.project_course_id,
                    e.label_id, e.label_category_id, e.label_sub_category_id
            )
        """ % {'table': self._table})


class LogbookDescriptiveStatsStudent(models.Model):
    _name = 'logbook.descriptive.stats.student'
    _auto = False
    _description = 'Statistik Deskriptif Logbook per Mahasiswa'

    student_id = fields.Many2one('student.student', string='Mahasiswa', readonly=True)
    student_name = fields.Char(string='Nama Mahasiswa', readonly=True)
    class_id = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name = fields.Char(string='Nama Kelas', readonly=True)
    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    total_logbooks = fields.Integer(string='Total Logbook')
    avg_logbooks_per_week = fields.Float(string='Rata-rata Logbook/Minggu')
    std_dev_logbooks = fields.Float(string='Std Dev Logbook/Minggu')
    active_weeks = fields.Integer(string='Jumlah Minggu Aktif')
    participation_rate = fields.Float(string='Tingkat Partisipasi (%)')

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_descriptive_stats_student AS (
                WITH weekly_stats AS (
                    SELECT 
                        student_id,
                        week_id,
                        COUNT(*) as logbook_count
                    FROM logbook_logbook
                    WHERE student_id IS NOT NULL AND week_id IS NOT NULL
                    GROUP BY student_id, week_id
                ),
                total_weeks AS (
                    SELECT COUNT(DISTINCT week_id) as week_count
                    FROM logbook_logbook
                    WHERE week_id IS NOT NULL
                )
                SELECT
                    row_number() OVER () AS id,
                    s.id AS student_id,
                    s.name AS student_name,
                    c.id AS class_id,
                    c.name AS class_name,
                    lb.project_course_id,
                    COUNT(lb.id) AS total_logbooks,
                    ROUND(AVG(ws.logbook_count)::numeric, 2) AS avg_logbooks_per_week,
                    ROUND(STDDEV(ws.logbook_count)::numeric, 2) AS std_dev_logbooks,
                    COUNT(DISTINCT lb.week_id) AS active_weeks,
                    ROUND(
                        (COUNT(DISTINCT lb.week_id)::float / NULLIF(tw.week_count, 0) * 100)::numeric,
                        2
                    ) AS participation_rate
                FROM student_student s
                JOIN class_class c ON c.id = s.class_id 
                JOIN logbook_logbook lb ON lb.student_id = s.id
                LEFT JOIN weekly_stats ws ON ws.student_id = s.id
                CROSS JOIN total_weeks tw
                GROUP BY s.id, s.name, c.id, c.name, lb.project_course_id, tw.week_count
            )
        """)
        
class LogbookWeeklyStatsStudent(models.Model):
    _name = 'logbook.weekly.stats.student'
    _auto = False
    _description = 'Statistik Per Minggu per Mahasiswa'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    student_id = fields.Many2one('student.student', string='Mahasiswa', readonly=True)
    student_name = fields.Char(string='Nama Mahasiswa', readonly=True)
    class_id = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name = fields.Char(string='Nama Kelas', readonly=True)
    week_id = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    total_logbooks = fields.Integer(string='Total Logbook', readonly=True)
    week_label = fields.Char(string='Label Minggu', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_weekly_stats_student AS (
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    l.project_course_id,
                    l.student_id,
                    s.name AS student_name,
                    s.class_id,
                    c.name AS class_name,
                    l.week_id,
                    w.start_date AS week_start_date,
                    w.end_date AS week_end_date,
                    COUNT(l.id) AS total_logbooks,
                    CONCAT('W', DENSE_RANK() OVER (
                        PARTITION BY l.project_course_id
                        ORDER BY w.start_date
                    )) AS week_label
                FROM logbook_logbook l
                JOIN student_student s ON s.id = l.student_id
                JOIN class_class c ON c.id = s.class_id
                JOIN course_activity w ON w.id = l.week_id AND w.type = 'week'
                WHERE l.week_id IS NOT NULL 
                    AND l.project_course_id IS NOT NULL
                GROUP BY 
                    l.project_course_id, l.student_id, s.name,
                    s.class_id, c.name, l.week_id, w.start_date, w.end_date
                ORDER BY w.start_date
            )
        """)
        
class LogbookExtractionWeeklyStudent(models.Model):
    _name = "logbook.extraction.weekly.student"
    _auto = False
    _description = "Tren Ekstraksi Logbook per Mahasiswa per Minggu"

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    student_id = fields.Many2one('student.student', string='Mahasiswa', readonly=True)
    student_name = fields.Char(string='Nama Mahasiswa', readonly=True)
    class_id = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name = fields.Char(string='Nama Kelas', readonly=True)
    week_id = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label = fields.Char(string='Label Minggu', readonly=True)
    extraction_count = fields.Integer(string='Jumlah Ekstraksi', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_student AS (
                WITH distinct_weeks AS (
                    SELECT 
                        lb.project_course_id,
                        lb.student_id,
                        w.id AS week_id,
                        w.start_date,
                        w.end_date,
                        DENSE_RANK() OVER (
                            PARTITION BY lb.project_course_id, lb.student_id
                            ORDER BY w.start_date
                        ) AS week_num
                    FROM logbook_logbook lb
                    JOIN course_activity w ON w.id = lb.week_id AND w.type = 'week'
                    GROUP BY 
                        lb.project_course_id, lb.student_id,
                        w.id, w.start_date, w.end_date
                )
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    dw.project_course_id,
                    dw.student_id,
                    s.name AS student_name,
                    s.class_id,
                    c.name AS class_name,
                    dw.week_id,
                    dw.start_date AS week_start_date,
                    dw.end_date AS week_end_date,
                    CONCAT('W', dw.week_num) AS week_label,
                    COUNT(e.id) AS extraction_count
                FROM distinct_weeks dw
                JOIN student_student s ON s.id = dw.student_id
                JOIN class_class c ON c.id = s.class_id
                LEFT JOIN logbook_logbook lb ON lb.student_id = dw.student_id 
                    AND lb.week_id = dw.week_id
                    AND lb.project_course_id = dw.project_course_id
                LEFT JOIN logbook_extraction e ON e.logbook_id = lb.id
                    AND e.content IS NOT NULL 
                    AND e.content != ''
                GROUP BY
                    dw.project_course_id,
                    dw.student_id,
                    s.name,
                    s.class_id,
                    c.name,
                    dw.week_id,
                    dw.start_date,
                    dw.end_date,
                    dw.week_num
                ORDER BY
                    dw.project_course_id,
                    dw.student_id,
                    dw.week_num
            )
        """)
        
class LogbookExtractionDescriptiveStatsStudent(models.Model):
    _name = "logbook.extraction.descriptive.stats.student"
    _auto = False
    _description = "Statistik Deskriptif Ekstraksi Logbook per Mahasiswa"

    # Dimensions
    project_course_id = fields.Many2one("project.course", string="Mata Kuliah", readonly=True)
    student_id = fields.Many2one("student.student", string="Mahasiswa", readonly=True)
    student_name = fields.Char(string="Nama Mahasiswa", readonly=True)
    class_id = fields.Many2one("class.class", string="Kelas", readonly=True)
    class_name = fields.Char(string="Nama Kelas", readonly=True)

    # Metrics
    total_extraction = fields.Integer(string="Total Ekstraksi", readonly=True)
    avg_extraction_per_logbook = fields.Float(string="Rata-rata Ekstraksi per Logbook", readonly=True)
    std_extraction_per_logbook = fields.Float(string="Std Dev Ekstraksi per Logbook", readonly=True)
    avg_extraction_per_week = fields.Float(string="Rata-rata Ekstraksi per Minggu", readonly=True)
    std_extraction_per_week = fields.Float(string="Std Dev Ekstraksi per Minggu", readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                WITH extraction_data AS (
                    SELECT 
                        lb.project_course_id,
                        lb.student_id,
                        s.name AS student_name,
                        s.class_id,
                        c.name AS class_name,
                        lb.id AS logbook_id,
                        lb.week_id,
                        COUNT(e.id) AS extraction_count
                    FROM logbook_logbook lb
                    JOIN student_student s ON s.id = lb.student_id
                    JOIN class_class c ON c.id = s.class_id
                    LEFT JOIN logbook_extraction e ON e.logbook_id = lb.id 
                        AND e.content IS NOT NULL 
                        AND e.content != ''
                    GROUP BY 
                        lb.project_course_id, lb.student_id, s.name,
                        s.class_id, c.name, lb.id, lb.week_id
                )
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    project_course_id,
                    student_id,
                    student_name,
                    class_id,
                    class_name,
                    SUM(extraction_count) AS total_extraction,
                    ROUND(AVG(extraction_count)::numeric, 2) AS avg_extraction_per_logbook,
                    ROUND(STDDEV(extraction_count)::numeric, 2) AS std_extraction_per_logbook,
                    ROUND(AVG(CASE WHEN week_id IS NOT NULL 
                        THEN extraction_count END)::numeric, 2) AS avg_extraction_per_week,
                    ROUND(STDDEV(CASE WHEN week_id IS NOT NULL 
                        THEN extraction_count END)::numeric, 2) AS std_extraction_per_week
                FROM extraction_data
                GROUP BY
                    project_course_id, student_id, student_name,
                    class_id, class_name
            )
        """ % self._table)
        
class LogbookExtractionWeeklyCategoryStudent(models.Model):
    _name = 'logbook.extraction.weekly.category.student'
    _auto = False
    _description = 'Tren Ekstraksi per Kategori per Mahasiswa per Minggu'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    student_id = fields.Many2one('student.student', string='Mahasiswa', readonly=True)
    student_name = fields.Char(string='Nama Mahasiswa', readonly=True)
    class_id = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name = fields.Char(string='Nama Kelas', readonly=True)
    week_id = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label = fields.Char(string='Label Minggu', readonly=True)
    category_id = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    extraction_count = fields.Integer(string='Jumlah Ekstraksi (poin ≠ 0)', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_category_student AS (
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    lb.project_course_id,
                    lb.student_id,
                    s.name AS student_name,
                    s.class_id,
                    c.name AS class_name,
                    lb.week_id,
                    w.start_date AS week_start_date,
                    w.end_date AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY') AS week_label,
                    e.label_category_id AS category_id,
                    COUNT(e.id) AS extraction_count
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON lb.id = e.logbook_id
                JOIN student_student s ON s.id = lb.student_id
                JOIN class_class c ON c.id = s.class_id
                JOIN course_activity w ON w.id = lb.week_id
                    AND w.type = 'week'
                WHERE
                    lb.project_course_id IS NOT NULL
                    AND e.content IS NOT NULL
                    AND e.content <> ''
                    AND e.label_category_id IS NOT NULL
                GROUP BY
                    lb.project_course_id,
                    lb.student_id,
                    s.name,
                    s.class_id,
                    c.name,
                    lb.week_id,
                    w.start_date,
                    w.end_date,
                    e.label_category_id
            )
        """)
        
class LogbookExtractionWeeklySubcategoryStudent(models.Model):
    _name = 'logbook.extraction.weekly.subcategory.student'
    _auto = False
    _description = 'Tren Ekstraksi per Subkategori per Mahasiswa per Minggu'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    student_id = fields.Many2one('student.student', string='Mahasiswa', readonly=True)
    student_name = fields.Char(string='Nama Mahasiswa', readonly=True)
    class_id = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name = fields.Char(string='Nama Kelas', readonly=True)
    week_id = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label = fields.Char(string='Label Minggu', readonly=True)
    category_id = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    subcategory_id = fields.Many2one('logbook.label.sub.category', string='Subkategori Label', readonly=True)
    extraction_count = fields.Integer(string='Jumlah Ekstraksi (poin ≠ 0)', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_subcategory_student AS (
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    lb.project_course_id,
                    lb.student_id,
                    s.name AS student_name,
                    s.class_id,
                    c.name AS class_name,
                    lb.week_id,
                    w.start_date AS week_start_date,
                    w.end_date AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY') AS week_label,
                    e.label_category_id AS category_id,
                    e.label_sub_category_id AS subcategory_id,
                    COUNT(e.id) AS extraction_count
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON lb.id = e.logbook_id
                JOIN student_student s ON s.id = lb.student_id
                JOIN class_class c ON c.id = s.class_id
                JOIN course_activity w ON w.id = lb.week_id
                    AND w.type = 'week'
                WHERE
                    lb.project_course_id IS NOT NULL
                    AND e.content IS NOT NULL
                    AND e.content <> ''
                    AND e.label_category_id IS NOT NULL
                    AND e.label_sub_category_id IS NOT NULL
                GROUP BY
                    lb.project_course_id,
                    lb.student_id,
                    s.name,
                    s.class_id,
                    c.name,
                    lb.week_id,
                    w.start_date,
                    w.end_date,
                    e.label_category_id,
                    e.label_sub_category_id
            )
        """)
        
class LogbookExtractionWeeklyLabelStudent(models.Model):
    _name = 'logbook.extraction.weekly.label.student'
    _auto = False
    _description = 'Tren Ekstraksi per Label per Mahasiswa per Minggu'

    project_course_id = fields.Many2one('project.course', string='Mata Kuliah', readonly=True)
    student_id = fields.Many2one('student.student', string='Mahasiswa', readonly=True)
    student_name = fields.Char(string='Nama Mahasiswa', readonly=True)
    class_id = fields.Many2one('class.class', string='Kelas', readonly=True)
    class_name = fields.Char(string='Nama Kelas', readonly=True)
    week_id = fields.Many2one('course.activity', string='Minggu', readonly=True)
    week_start_date = fields.Date(string='Tanggal Mulai Minggu', readonly=True)
    week_end_date = fields.Date(string='Tanggal Akhir Minggu', readonly=True)
    week_label = fields.Char(string='Label Minggu', readonly=True)
    label_id = fields.Many2one('logbook.label', string='Label', readonly=True)
    category_id = fields.Many2one('logbook.label.category', string='Kategori Label', readonly=True)
    subcategory_id = fields.Many2one('logbook.label.sub.category', string='Subkategori Label', readonly=True)
    extraction_count = fields.Integer(string='Jumlah Ekstraksi (poin ≠ 0)', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW logbook_extraction_weekly_label_student AS (
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    lb.project_course_id,
                    lb.student_id,
                    s.name AS student_name,
                    s.class_id,
                    c.name AS class_name,
                    lb.week_id,
                    w.start_date AS week_start_date,
                    w.end_date AS week_end_date,
                    to_char(w.start_date, 'DD Mon YYYY') AS week_label,
                    e.label_id,
                    e.label_category_id AS category_id,
                    e.label_sub_category_id AS subcategory_id,
                    COUNT(e.id) AS extraction_count
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON lb.id = e.logbook_id
                JOIN student_student s ON s.id = lb.student_id
                JOIN class_class c ON c.id = s.class_id
                JOIN course_activity w ON w.id = lb.week_id
                    AND w.type = 'week'
                WHERE
                    lb.project_course_id IS NOT NULL
                    AND e.content IS NOT NULL
                    AND e.content <> ''
                    AND e.label_id IS NOT NULL
                    AND e.label_category_id IS NOT NULL
                GROUP BY
                    lb.project_course_id,
                    lb.student_id,
                    s.name,
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