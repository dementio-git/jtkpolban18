# logbook_class_analytics.py
from odoo import models, fields, tools


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
