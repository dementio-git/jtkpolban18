from odoo import models, fields, api

class SkillExtraction(models.Model):
    _name = 'skill.extraction'
    _description = 'Skill Extraction'

    student_id = fields.Many2one(
        'student.student',
        string='Student',
    )
    skill_item_id = fields.Many2one(
        'skill.item',
        string='Skill',
    )
    skill_point = fields.Integer(
        string='Skill Point',
    )
    skill_group_id = fields.Many2one(
        'skill.group',
        string='Skill Group',
        related='skill_item_id.skill_group_id',
        readonly=False
    )
    skill_type = fields.Selection(
        related='skill_group_id.skill_type',
        string='Skill Classification',
        readonly=False
    )
    
    content = fields.Text(
        string='Content',
    )