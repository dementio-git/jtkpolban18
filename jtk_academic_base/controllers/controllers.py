# -*- coding: utf-8 -*-
# from odoo import http


# class JtkEduBase(http.Controller):
#     @http.route('/jtk_edu_base/jtk_edu_base', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/jtk_edu_base/jtk_edu_base/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('jtk_edu_base.listing', {
#             'root': '/jtk_edu_base/jtk_edu_base',
#             'objects': http.request.env['jtk_edu_base.jtk_edu_base'].search([]),
#         })

#     @http.route('/jtk_edu_base/jtk_edu_base/objects/<model("jtk_edu_base.jtk_edu_base"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('jtk_edu_base.object', {
#             'object': obj
#         })
