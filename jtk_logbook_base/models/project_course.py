from odoo import models, fields

class ProjectCourse(models.Model):
    _inherit = 'project.course'
    
    logbook_label_ids = fields.Many2many(
        'logbook.label',
        string='Logbook Labels'
    )
    
    
    