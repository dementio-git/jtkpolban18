from Odoo import models, fields, api

class SelfAssessment(models.Model):
    _name = 'self.assessment'
    _description = 'Self Assessment'
    
    name =  fields.Char(string='Assessment Name')
       
class SelfAssessmentQuestion(models.Model):
    _name = 'self.assessment.question'
    _description = 'Self Assessment Question'
    
    name = fields.Char(string='Question')
    self_assessment_id = fields.Many2one('self.assessment', string='Self Assessment', ondelete='cascade')
    
    
class SelfAssessmentAnswer(models.Model):
    _name = 'self.assessment.answer'
    _description = 'Self Assessment Answer'

    
class SelfAssessmentAnswerLine(models.Model):
    _name = 'self.assessment.answer.line'
    _description = 'Self Assessment Answer Line'


class SelfAssessmentQuestionLabel(models.Model):
    _name = 'self.assessment.question.label'
    _description = 'Self Assessment Question Label'
    
    name = fields.Char(string='Label')
    