from odoo import models, fields, tools, api

class LogbookLabelAnalytics(models.Model):
    _name = 'logbook.label.analytics'
    _description = 'Analisis Frekuensi Label Logbook'
    _auto = False

    label_id = fields.Many2one('logbook.label', string='Label')
    week_id = fields.Many2one('week.line', string='Minggu')
    project_course_id = fields.Many2one('project.course', string='Mata Kuliah')
    class_id = fields.Many2one('student.class', string='Kelas')
    count = fields.Integer(string='Jumlah')
