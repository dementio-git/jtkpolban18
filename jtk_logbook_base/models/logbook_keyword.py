# jtkpolban18\jtk_logbook_base\models\logbook_keyword.py

from odoo import models, fields, api

class LogbookKeyword(models.Model):
    _name = 'logbook.keyword'
    _description = 'Logbook Keyword'

    name = fields.Char(string='Keyword')
    logbook_extraction_id = fields.Many2one('logbook.extraction', string='Logbook Extraction', ondelete='cascade')
    logbook_id = fields.Many2one('logbook.logbook', string='Logbook', ondelete='cascade')