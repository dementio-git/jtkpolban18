from odoo import models, fields, api


class ClassClass(models.Model):
    _name = 'class.class'
    _description = 'Class'

    name = fields.Char(string='Nama')
    code = fields.Char(string='Kode')
    active = fields.Boolean(string='Active', default=True)
    study_program_id = fields.Many2one('study.program', string='Program Studi')
    semester = fields.Selection([
        ('1', 'Semester 1'),
        ('2', 'Semester 2'),
        ('3', 'Semester 3'),
        ('4', 'Semester 4'),
        ('5', 'Semester 5'),
        ('6', 'Semester 6'),
        ('7', 'Semester 7'),
        ('8', 'Semester 8')
    ], string='Semester')
    student_ids = fields.One2many('student.student', 'class_id', string='Students')