# jtkpolban18\jtk_project_course_base\models\project_course.py

from odoo import models, fields, api

class ProjectCourse(models.Model):
    _name = 'project.course'
    _description = 'Project Course'
    
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
    subject_id = fields.Many2one('subject.subject', string='Subject')
    activity_ids = fields.One2many('course.activity', 'course_id', string='Calendar Events')
    milestone_ids = fields.One2many('course.activity', 'course_id', domain=[('type', '=', 'milestone')], string='Milestones')
    week_ids = fields.One2many('course.activity', 'course_id', domain=[('type', '=', 'week')], string='Weeks')
    other_activity_ids = fields.One2many('course.activity', 'course_id', domain=[('type', 'not in', ['milestone', 'week'])], string='Other Activities')
    class_ids = fields.Many2many('class.class', string='Kelas')
    lecturer_ids = fields.Many2many('lecturer.lecturer', string='Dosen Pengampu')
    student_group_ids = fields.One2many('student.group', 'project_course_id', string='Kelompok Mahasiswa')
    student_ids = fields.Many2many('student.student', string='Mahasiswa', compute='_compute_student_ids', store=True)
    
    @api.depends('class_ids')
    def _compute_student_ids(self):
        for course in self:
            student_ids = self.env['student.student']
            for class_id in course.class_ids:
                student_ids |= class_id.student_ids
            course.student_ids = student_ids
    
    def open_project_course(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'project.course',
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'current',
        }
    
    def open_project_course_dashboard(self):
        self.ensure_one()
        return {
            "type": "ir.actions.client",
            "name": "Project Dashboard",
            "tag": "jtk_project_course_base.project_course_dashboard",
            "context": {"default_project_course_id": self.id},
        }
