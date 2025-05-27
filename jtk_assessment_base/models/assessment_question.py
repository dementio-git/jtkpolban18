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
    subcategory_id = fields.Many2one('assessment.question.subcategory', string='Sub Kategori')
    category_id = fields.Many2one('assessment.question.category', string='Category')
    choice_ids = fields.One2many('assessment.choice', 'question_id', string='Choices')
    sequence = fields.Integer(string='Sequence')
    label_id = fields.Many2one(
        'assessment.question.label', 
        string='Label',
    )
    answer_line_ids = fields.One2many(
        'assessment.answer.line', 
        'question_id', 
        string='Answer Lines',
    )
    
    
class AssessmentQuestionCategory(models.Model):
    _name = 'assessment.question.category'
    _description = 'Assessment Question Category'

    name = fields.Char(string='Category', required=True)
class AssessmentQuestionSubcategory(models.Model):
    _name = 'assessment.question.subcategory'
    _description = 'Assessment Question Sub Category'

    name = fields.Char(string='Sub Category', required=True)
    
class AssessmentQuestionLabel(models.Model):
    _name = 'assessment.question.label'
    _description = 'Assessment Question Label'

    name = fields.Char(string='Label', required=True) 