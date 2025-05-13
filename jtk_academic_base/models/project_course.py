from odoo import models, fields, api

class ProjectCourse(models.Model):
    _name = 'project.course'
    _description = 'Project Course'
    
    name = fields.Char(string='Nama', required=True)
    code = fields.Char(string='Kode', required=True)
    active = fields.Boolean(string='Active', default=True)
    subject_id = fields.Many2one('subject.subject', string='Subject')
    week_line_ids = fields.One2many('week.line', 'course_id', string='Week Lines')
    class_ids = fields.Many2many('class.class', string='Kelas')
    