# -*- coding: utf-8 -*-
# from odoo import http


# class JtkLogbookAnalytic(http.Controller):
#     @http.route('/jtk_logbook_analytic/jtk_logbook_analytic', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/jtk_logbook_analytic/jtk_logbook_analytic/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('jtk_logbook_analytic.listing', {
#             'root': '/jtk_logbook_analytic/jtk_logbook_analytic',
#             'objects': http.request.env['jtk_logbook_analytic.jtk_logbook_analytic'].search([]),
#         })

#     @http.route('/jtk_logbook_analytic/jtk_logbook_analytic/objects/<model("jtk_logbook_analytic.jtk_logbook_analytic"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('jtk_logbook_analytic.object', {
#             'object': obj
#         })
