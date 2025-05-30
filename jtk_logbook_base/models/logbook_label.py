from odoo import models, fields, api

class LogbookLabel(models.Model):
    _name = 'logbook.label'
    _description = 'Logbook Label'
    
    name = fields.Char(string='Label', required=True)
    description = fields.Text(string='Deskripsi')
    has_point = fields.Boolean(string='Poin', default=False)
    points_rule = fields.Text(string='Aturan Poin')
    level_ids = fields.Many2many('logbook.label.level', string='Level')
    group_id = fields.Many2one('logbook.label.group', string='Group by Point')
    category_id = fields.Many2one('logbook.label.category', string='Kategori')
    sub_category_id = fields.Many2one('logbook.label.sub.category', string='Sub Kategori', domain="[('category_ids', 'in', [category_id])]")
    is_required = fields.Boolean(string='Wajib', default=False)
    
class LogbookLabelLevel(models.Model):
    _name = 'logbook.label.level'
    _description = 'Logbook Label Level'
    
    name = fields.Char(string='Level', required=True)
    
class LogbookLabelGroup(models.Model):
    _name = 'logbook.label.group'
    _description = 'Logbook Label Group'
    
    name = fields.Char(string='Group')
    
    
class LogbookLabelCategory(models.Model):
    _name = 'logbook.label.category'
    _description = 'Logbook Label Category'
    
    name = fields.Char(string='Kategori', required=True)
    sub_category_ids = fields.Many2many('logbook.label.sub.category', string='Sub Kategori')
    
class LogbookLabelSubCategory(models.Model):
    _name = 'logbook.label.sub.category'
    _description = 'Logbook Label Sub Category'
    
    name = fields.Char(string='Sub Kategori', required=True)
    category_ids = fields.Many2many('logbook.label.category', string='Kategori')
