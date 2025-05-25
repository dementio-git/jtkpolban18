from odoo import models, fields, api

class AssessmentQuestion(models.Model):
    _name = 'assessment.question'
    _description = 'Assessment Question'

    name = fields.Char(string='Question', required=True)
    assessment_id = fields.Many2one('assessment.assessment', string='Assessment')
    type = fields.Selection([
        ('text', 'Text'),
        ('multiple_choice', 'Multiple Choice'),
        ('true_false', 'True/False'),
        ('rating', 'Rating'),
        ('essay', 'Essay'),
        ('file_upload', 'File Upload'),
        ('other', 'Other'),
    ], string='Question Type', )
    label_id = fields.Many2one('assessment.question.label', string='Labels')
    category_id = fields.Many2one('assessment.question.category', string='Category')
    choice_ids = fields.One2many('assessment.choice', 'question_id', string='Choices')
    
class AssessmentQuestionLabel(models.Model):
    _name = 'assessment.question.label'
    _description = 'Assessment Question Label'

    name = fields.Char(string='Label', required=True)
    
class AssessmentQuestionCategory(models.Model):
    _name = 'assessment.question.category'
    _description = 'Assessment Question Category'

    name = fields.Char(string='Category', required=True)