from odoo import models, fields, api

class SkillItem(models.Model):
    _name = 'skill.item'
    _description = 'Skill Item'

    name = fields.Char(string='Skill Name', required=True)
    skill_group_id = fields.Many2one(
        'skill.group',
        string='Skill Group',
    )
    
    student_ids = fields.Many2many(
        'student.student', 
        'student_skill_summary_rel', 
        'skill_id', 
        'student_id', 
        string='Mahasiswa yang Memiliki')
    
    skill_type = fields.Selection(
        related='skill_group_id.skill_type',
        string='Skill Classification',
        readonly=False
    )
    
    skill_extraction_ids = fields.One2many(
        'skill.extraction',
        'skill_item_id',
        string='Skill Extraction',
    )