from odoo import models, fields, api

class Subject(models.Model):
    _name = 'subject.subject'
    _description = 'Subject'

    name = fields.Char(string='Nama', required=True)
    code = fields.Char(string='Kode', required=True)
    active = fields.Boolean(string='Active', default=True)
    is_practicum = fields.Boolean(string='Mata Kuliah Praktikum', default=False)
    study_program_id = fields.Many2one('study.program', string='Program Studi')