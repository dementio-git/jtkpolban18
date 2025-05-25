# -*- coding: utf-8 -*-
# from odoo import http


# class JtkAssessmentBase(http.Controller):
#     @http.route('/jtk_assessment_base/jtk_assessment_base', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/jtk_assessment_base/jtk_assessment_base/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('jtk_assessment_base.listing', {
#             'root': '/jtk_assessment_base/jtk_assessment_base',
#             'objects': http.request.env['jtk_assessment_base.jtk_assessment_base'].search([]),
#         })

#     @http.route('/jtk_assessment_base/jtk_assessment_base/objects/<model("jtk_assessment_base.jtk_assessment_base"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('jtk_assessment_base.object', {
#             'object': obj
#         })
