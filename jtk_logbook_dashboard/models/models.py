# -*- coding: utf-8 -*-

# from odoo import models, fields, api


# class jtk_logbook_dashboard(models.Model):
#     _name = 'jtk_logbook_dashboard.jtk_logbook_dashboard'
#     _description = 'jtk_logbook_dashboard.jtk_logbook_dashboard'

#     name = fields.Char()
#     value = fields.Integer()
#     value2 = fields.Float(compute="_value_pc", store=True)
#     description = fields.Text()
#
#     @api.depends('value')
#     def _value_pc(self):
#         for record in self:
#             record.value2 = float(record.value) / 100
