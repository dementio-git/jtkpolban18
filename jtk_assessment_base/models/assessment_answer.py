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
    answer_line_ids = fields.One2many(
        'assessment.answer.line', 
        'answer_id', 
        string='Answer Lines',
        store=True
    )    
    
    @api.onchange('assessment_id')
    def _onchange_assessment(self):
        if self.assessment_id:
            answer_lines = [(5, 0, 0)]  # Clear existing lines
            for question in self.assessment_id.question_ids:
                answer_lines.append((0, 0, {
                    'question_id': question.id,
                }))
            self.answer_line_ids = answer_lines
            
    @api.model
    def create(self, vals):
        record = super(AssessmentAnswer, self).create(vals)
        if record.assessment_id:
            answer_lines = []
            for question in record.assessment_id.question_ids:
                answer_lines.append((0, 0, {
                    'question_id': question.id,
                }))
            record.write({'answer_line_ids': answer_lines})
        return record


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
    student_id = fields.Many2one(
        'student.student', 
        string='Student', 
        related='answer_id.student_id'
    )
    assessment_id = fields.Many2one(
        'assessment.assessment', 
        string='Assessment', 
        related='answer_id.assessment_id'
    )
    category_id = fields.Many2one(
        'assessment.question.category', 
        string='Category', 
        related='question_id.category_id',
        store=True
    )
    subcategory_id = fields.Many2one(
        'assessment.question.subcategory', 
        string='Sub Category', 
        related='question_id.subcategory_id',
        store=True
    )
    label_id = fields.Many2one(
        'assessment.question.label', 
        string='Label', 
        related='question_id.label_id',
        store=True
    )
    is_correct = fields.Boolean(
        string='Is Correct',
        related='choice_id.is_correct',
        store=True
    )
    point = fields.Integer(
        string='Point',
        related='choice_id.point',
        store=True
    )
