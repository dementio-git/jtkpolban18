# jtkpolban18\jtk_logbook_base\models\logbook_label.py

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
    point_rule_ids = fields.One2many('logbook.label.point.rule','label_id', string='Aturan Poin')
    
    # @api.depends('point_rule_template_id')
    # def _compute_point_rule_ids(self):
    #     for record in self:
    #         if record.point_rule_template_id:
    #             record.point_rule_ids = record.point_rule_template_id.point_rule_ids
    #         else:
    #             record.point_rule_ids = False
    
    
# class LogbookLabelLevel(models.Model):
#     _name = 'logbook.label.level'
#     _description = 'Logbook Label Level'
    
#     name = fields.Char(string='Level', required=True)
    
class LogbookLabelPointRule(models.Model):
    _name = 'logbook.label.point.rule'
    _description = 'Logbook Label Point Rule'
    
    label_id = fields.Many2one('logbook.label', string='Label', ondelete='cascade')
    name = fields.Char(string='Nama Aturan', compute='_compute_name', store=True)
    point = fields.Integer(string='Poin', required=True)
    description = fields.Char(string='Deskripsi')
    
    @api.depends('point', 'description')
    def _compute_name(self):
        for record in self:
            if record.point or record.description:
                record.name = f"{record.point}: {record.description}"
        
# class LogbookLabelPointRuleTemplate(models.Model):
#     _name = 'logbook.label.point.rule.template'
#     _description = 'Logbook Label Point Rule Template'
    
#     name = fields.Char(string='Nama Aturan', required=True)
#     point_rule_ids = fields.Many2many('logbook.label.point.rule', string='Aturan Poin')

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
