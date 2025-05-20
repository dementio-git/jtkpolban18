# -*- coding: utf-8 -*-
# from odoo import http


# class JtkProjectCourseBase(http.Controller):
#     @http.route('/jtk_project_course_base/jtk_project_course_base', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/jtk_project_course_base/jtk_project_course_base/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('jtk_project_course_base.listing', {
#             'root': '/jtk_project_course_base/jtk_project_course_base',
#             'objects': http.request.env['jtk_project_course_base.jtk_project_course_base'].search([]),
#         })

#     @http.route('/jtk_project_course_base/jtk_project_course_base/objects/<model("jtk_project_course_base.jtk_project_course_base"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('jtk_project_course_base.object', {
#             'object': obj
#         })
