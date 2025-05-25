from odoo import models, fields, api

class AssessmentChoice(models.Model):
    _name = 'assessment.choice'
    _description = 'Assessment Choice'

    name = fields.Char(string='Choice', required=True)
    question_id = fields.Many2one('assessment.question', string='Question', required=True)
    label = fields.Char(string='Label/Point')
    is_correct = fields.Boolean(string='Is Correct')
    point = fields.Integer(string='Point')