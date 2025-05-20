# -*- coding: utf-8 -*-

# from odoo import models, fields, api


# class jtk_project_course_base(models.Model):
#     _name = 'jtk_project_course_base.jtk_project_course_base'
#     _description = 'jtk_project_course_base.jtk_project_course_base'

#     name = fields.Char()
#     value = fields.Integer()
#     value2 = fields.Float(compute="_value_pc", store=True)
#     description = fields.Text()
#
#     @api.depends('value')
#     def _value_pc(self):
#         for record in self:
#             record.value2 = float(record.value) / 100
