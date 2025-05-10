# -*- coding: utf-8 -*-
# from odoo import http


# class JtkStudentSkill(http.Controller):
#     @http.route('/jtk_student_skill/jtk_student_skill', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/jtk_student_skill/jtk_student_skill/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('jtk_student_skill.listing', {
#             'root': '/jtk_student_skill/jtk_student_skill',
#             'objects': http.request.env['jtk_student_skill.jtk_student_skill'].search([]),
#         })

#     @http.route('/jtk_student_skill/jtk_student_skill/objects/<model("jtk_student_skill.jtk_student_skill"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('jtk_student_skill.object', {
#             'object': obj
#         })
