from odoo import models, fields, api


class Assessment(models.Model):
    _name = 'assessment.assessment'
    _description = 'Assessment'
    
    name = fields.Char(string='Nama Asesmen', required=True)
    description = fields.Text(string='Description')
    code = fields.Char(string='Kode Asesmen')
    type = fields.Selection([
        ('self_assessment', 'Self Assessment'),
        ('peer_assessment', 'Peer Assessment'),
        ('pretest', 'Pre-Test'),
        ('posttest', 'Post-Test'),
        ('quiz', 'Quiz'),
        ('exam', 'Exam'),
        ('survey', 'Survey'),
        ('reflection', 'Reflection'),
        ('other', 'Other'),
    ], string='Tipe Asesmen')
    question_ids = fields.One2many('assessment.question', 'assessment_id', string='Questions')
    answer_ids = fields.One2many('assessment.answer', 'assessment_id', string='Answers')

