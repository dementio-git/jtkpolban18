from odoo import models, fields, api

class LogbookExtraction(models.Model):
    _name = 'logbook.extraction'
    _description = 'Logbook Extraction Model'
    

    name = fields.Char(string='Kode', compute='_compute_name', store=True)
    logbook_id = fields.Many2one('logbook.logbook', string='Logbook', required=True, ondelete='cascade')
    label_id = fields.Many2one('logbook.label', string='Label')
    content = fields.Text(string='Content')
    logbook_keyword_ids = fields.One2many('logbook.keyword', 'logbook_extraction_id', string='Keyword')
    level = fields.Char(string='Level')
    label_category_id = fields.Many2one('logbook.label.category', related='label_id.category_id', string='Kategori Label', store=True)
    label_sub_category_id = fields.Many2one('logbook.label.sub.category', related='label_id.sub_category_id', string='Sub Kategori Label', store=True)
    point = fields.Float(string='Poin')
    
    def _compute_name(self):
        for record in self:
            if record.id_logbook and record.label:
                record.name = f"Ext-{record.label}-{record.logbook_id.name}"
            else:
                record.name = False
                
                
                