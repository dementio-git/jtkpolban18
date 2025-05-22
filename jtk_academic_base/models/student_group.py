from odoo import models, fields, api

class StudentGroup(models.Model):
    _name = 'student.group'
    _description = 'Student Group'
    
    name = fields.Char(string='Nama', required=True)
    class_id = fields.Many2one('class.class', string='Kelas')
    student_group_line_ids = fields.One2many('student.group.line', 'group_id', string='Anggota Kelompok')   
    
class StudentGroupLine(models.Model):
    _name = 'student.group.line'
    _description = 'Student Group Line'
    
    student_id = fields.Many2one('student.student', string='Mahasiswa')
    role = fields.Many2one('student.group.role', string='Role')
    is_leader = fields.Boolean(string='Ketua Kelompok')
    group_id = fields.Many2one('student.group', string='Kelompok Mahasiswa', ondelete='cascade')
    
class StudentGroupRole(models.Model):
    _name = 'student.group.role'
    _description = 'Student Group Role'
    
    name = fields.Char(string='Nama', required=True)
    