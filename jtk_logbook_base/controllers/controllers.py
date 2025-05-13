# -*- coding: utf-8 -*-
# from odoo import http


# class JtkPjblLogbook(http.Controller):
#     @http.route('/jtk_pjbl_logbook/jtk_pjbl_logbook', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/jtk_pjbl_logbook/jtk_pjbl_logbook/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('jtk_pjbl_logbook.listing', {
#             'root': '/jtk_pjbl_logbook/jtk_pjbl_logbook',
#             'objects': http.request.env['jtk_pjbl_logbook.jtk_pjbl_logbook'].search([]),
#         })

#     @http.route('/jtk_pjbl_logbook/jtk_pjbl_logbook/objects/<model("jtk_pjbl_logbook.jtk_pjbl_logbook"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('jtk_pjbl_logbook.object', {
#             'object': obj
#         })
