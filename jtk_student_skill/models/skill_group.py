from odoo import models, fields, api

class SkillGroup(models.Model):
    _name = 'skill.group'
    _description = 'Skill Group'

    name = fields.Char(string='Nama Kelompok Skill', required=True)
    # pilihan hard skill atau soft skill
    skill_type = fields.Selection([
        ('hardskill', 'Hard Skill'), 
        ('softskill', 'Soft Skill')
    ], string='Tipe Skill')
    
    skill_item_ids = fields.One2many(
        'skill.item', 
        'skill_group_id', 
        string='Skill Items')
    
    skill_line_ids = fields.One2many(
        'skill.line',
        'skill_group_id',
        string='Skill Lines',
    )

    
    
    
    