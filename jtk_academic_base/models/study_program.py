from odoo import models, fields, api

class StudyProgram(models.Model):
    _name = 'study.program'
    _description = 'Study Program'
    _sql_constraints = [
        ('unique_code', 'unique(code)', 'Study Program code must be unique!')
    ]
    
    name = fields.Char(string='Nama', required=True)
    code = fields.Char(string='Kode', required=True)
    active = fields.Boolean(string='Active', default=True)
    description = fields.Text(string='Description')
    head_of_program = fields.Many2one('lecturer.lecturer', string='Head of Program')
    # department_id = fields.Many2one('jtk.department', string='Department', required=True)
    
    
    