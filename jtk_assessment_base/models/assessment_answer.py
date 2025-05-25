from odoo import models, fields, api

class AssessmentAnswer(models.Model):
    _name = 'assessment.answer'
    _description = 'Assessment Answer'

    assessment_id = fields.Many2one(
        'assessment.assessment', 
        string='Assessment', 
        required=True, 
        ondelete='cascade'
    )
    student_id = fields.Many2one(
        'student.student',
        string='Student',
        required=True,
        ondelete='cascade'
    )
    
class AssessmentAnswerLine(models.Model):
    _name = 'assessment.answer.line'
    _description = 'Assessment Answer Line'

    answer_id = fields.Many2one(
        'assessment.answer', 
        string='Answer', 
        required=True, 
        ondelete='cascade'
    )
    question_id = fields.Many2one(
        'assessment.question', 
        string='Question', 
        required=True, 
        ondelete='cascade'
    )
    choice_id = fields.Many2one(
        'assessment.choice', 
        string='Choice', 
        domain="[('question_id', '=', question_id)]",
        ondelete='cascade'
    )
    