from odoo import models, fields, api

class Student(models.Model):
    _inherit = 'student.student'

    skill_line_ids = fields.One2many(
        'skill.line',
        'student_id',
        string='Skill Lines',
    )
    
    skill_extraction_ids = fields.One2many(
        'skill.extraction',
        'student_id',
        string='Skill Extractions',
    )
    
    skill_extraction_count = fields.Integer(
        string='Skill Extraction Count',
        compute='_compute_skill_extraction_count',
    )
    
    @api.depends('skill_extraction_ids')
    def _compute_skill_extraction_count(self):
        for student in self:
            student.skill_extraction_count = len(student.skill_extraction_ids)
            
    def action_view_skill_extraction(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Skill Extractions',
            'res_model': 'skill.extraction',
            'view_mode': 'list,form',
            'domain': [('student_id', '=', self.id)],
            'context': {'create': False},
        }