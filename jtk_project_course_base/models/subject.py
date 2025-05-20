from odoo import models, fields, api

class Subject(models.Model):
    _inherit = 'subject.subject'
    
    study_program_id = fields.Many2one('study.program', string='Program Studi')
