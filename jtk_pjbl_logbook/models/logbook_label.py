from odoo import models, fields, api


class LogbookLabel(models.Model):
    _name = 'logbook.label'
    _description = 'Logbook Label'
    
    name = fields.Char(string='Label', required=True)
    description = fields.Text(string='Deskripsi')
    has_point = fields.Boolean(string='Poin', default=False)
    points_rule = fields.Text(string='Aturan Poin')
    level_ids = fields.Many2many('logbook.label.level', string='Level')
    
    
    
class LogbookLabelLevel(models.Model):
    _name = 'logbook.label.level'
    _description = 'Logbook Label Level'
    
    name = fields.Char(string='Level', required=True)