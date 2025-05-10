from odoo import models, fields, api

class SkillLine(models.Model):
    _name = 'skill.line'
    _description = 'Skill Line'

    student_id = fields.Many2one(
        'student.student',
        string='Student',
    )
    skill_item_id = fields.Many2one(
        'skill.item',
        string='Skill',
    )
    skill_group_id = fields.Many2one(
        'skill.group',
        string='Skill Category',
        related='skill_item_id.skill_group_id')
    
    skill_type = fields.Selection(
        related='skill_group_id.skill_type',
        string='Skill Classification',
    )
    
    total_point = fields.Integer(
        string='Total Poin',
    )
    level = fields.Selection([
        ('1', 'Level 1'),
        ('2', 'Level 2'),
        ('3', 'Level 3'),
        ('4', 'Level 4'),
        ('5', 'Level 5'),
    ], string='Level', default='1') 
    