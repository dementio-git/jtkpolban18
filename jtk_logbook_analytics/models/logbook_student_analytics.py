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
