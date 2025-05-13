from odoo import models, fields, api

class SkillExtraction(models.Model):
    _inherit = 'skill.extraction'
    
    logbook_id = fields.Many2one(
        'logbook.logbook',
        string='Logbook',
        ondelete='cascade'
    )
    
    
    
    
    