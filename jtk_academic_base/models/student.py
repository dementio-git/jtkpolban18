from odoo import models, fields, api

class ResPartner(models.Model):
    _inherit = 'res.partner'

    student_id = fields.Many2one('student.student', string='Student ID')


class Student(models.Model):
    _name = 'student.student'
    _description = 'Student'
    _sql_constraints = [
        ('nim_unique', 'unique(nim)', 'NIM must be unique!')
    ]

    partner_id = fields.Many2one('res.partner', string='Partner ID', ondelete='cascade')
    name = fields.Char(related='partner_id.name', string='Nama', store=True, readonly=False)
    email = fields.Char(related='partner_id.email', string='Email', store=True, readonly=False)
    phone = fields.Char(related='partner_id.phone', string='Telepon', store=True, readonly=False)
    # address = fields.Text(related='partner_id.street', string='Address', store=True, readonly=False)
    nim = fields.Char(string='NIM')
    gender = fields.Selection([
        ('male', 'Laki-laki'),
        ('female', 'Perempuan')
    ], string='Jenis Kelamin')
    school_origin = fields.Char(string='Asal Sekolah')
    current_gpa = fields.Float(string='IPK Terbaru', digits=(3,2))
    
    class_id = fields.Many2one('class.class', string='Kelas')
    
    # entry_year = fields.Integer(string='Angkatan / Tahun Masuk')
    # study_program = fields.Selection([
    #     ('ti', 'Teknik Informatika'),
    #     ('si', 'Sistem Informasi')
    # ], string='Program Studi')

    