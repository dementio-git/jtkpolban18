from odoo import models, fields, api

class LogbookExtraction(models.Model):
    _name = 'logbook.extraction'
    _description = 'Logbook Extraction Model'
    

    name = fields.Char(string='Kode', compute='_compute_name', store=True)
    logbook_id = fields.Many2one('logbook.logbook', string='Logbook', required=True)
    label_id = fields.Many2one('logbook.label', string='Label')
    content = fields.Text(string='Content')
    logbook_keyword_ids = fields.One2many('logbook.keyword', 'logbook_extraction_id', string='Keyword')
    level_ids = fields.Many2many('logbook.label.level', string='Level')
    point = fields.Float(string='Poin')
    
    def _compute_name(self):
        for record in self:
            if record.id_logbook and record.label:
                record.name = f"Ext-{record.label}-{record.logbook_id.name}"
            else:
                record.name = False
                
                
                