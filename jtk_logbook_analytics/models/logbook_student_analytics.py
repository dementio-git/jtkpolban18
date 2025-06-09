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



class LogbookExtractionStudentCategoryAggregate(models.Model):
    _name = "logbook.extraction.student.category.aggregate"
    _description = "Total Poin per Mahasiswa per Kategori Label"
    _auto = False

    student_id = fields.Many2one("student.student", string="Mahasiswa", readonly=True)
    student_name = fields.Char(string="Nama Mahasiswa", readonly=True)
    category_id = fields.Many2one("logbook.label.category", string="Kategori", readonly=True)
    total_point = fields.Float(string="Total Poin", readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT
                    row_number() OVER () AS id,
                    lb.student_id,
                    s.name AS student_name,
                    e.label_category_id AS category_id,
                    SUM(e.point)::float AS total_point
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON lb.id = e.logbook_id
                JOIN student_student s ON s.id = lb.student_id
                WHERE e.label_category_id IS NOT NULL
                    AND e.point IS NOT NULL
                GROUP BY lb.student_id, s.name, e.label_category_id
            )
        """ % self._table)


class LogbookExtractionStudentSubcategoryAggregate(models.Model):
    _name = "logbook.extraction.student.subcategory.aggregate"
    _description = "Total Poin per Mahasiswa per Subkategori Label"
    _auto = False

    student_id = fields.Many2one("student.student", string="Mahasiswa", readonly=True)
    student_name = fields.Char(string="Nama Mahasiswa", readonly=True)
    subcategory_id = fields.Many2one("logbook.label.sub.category", string="Subkategori", readonly=True)
    total_point = fields.Float(string="Total Poin", readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT
                    row_number() OVER () AS id,
                    lb.student_id,
                    s.name AS student_name,
                    e.label_sub_category_id AS subcategory_id,
                    SUM(e.point)::float AS total_point
                FROM logbook_extraction e
                JOIN logbook_logbook lb ON lb.id = e.logbook_id
                JOIN student_student s ON s.id = lb.student_id
                WHERE e.label_sub_category_id IS NOT NULL
                    AND e.point IS NOT NULL
                GROUP BY lb.student_id, s.name, e.label_sub_category_id
            )
        """ % self._table)
