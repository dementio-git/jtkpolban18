from odoo import models, fields, api

class AssessmentChoice(models.Model):
    _name = 'assessment.choice'
    _description = 'Assessment Choice'

    name = fields.Char(string='Choice', required=True)
    sequence = fields.Integer(string='Sequence' )
    question_id = fields.Many2one('assessment.question', string='Question', required=True)
    identifier = fields.Char(string='Identifier')
    is_correct = fields.Boolean(string='Is Correct')
    point = fields.Integer(string='Point')
    
    