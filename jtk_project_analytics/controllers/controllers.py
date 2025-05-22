# -*- coding: utf-8 -*-
# from odoo import http


# class JtkProjectAnalytics(http.Controller):
#     @http.route('/jtk_project_analytics/jtk_project_analytics', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/jtk_project_analytics/jtk_project_analytics/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('jtk_project_analytics.listing', {
#             'root': '/jtk_project_analytics/jtk_project_analytics',
#             'objects': http.request.env['jtk_project_analytics.jtk_project_analytics'].search([]),
#         })

#     @http.route('/jtk_project_analytics/jtk_project_analytics/objects/<model("jtk_project_analytics.jtk_project_analytics"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('jtk_project_analytics.object', {
#             'object': obj
#         })
