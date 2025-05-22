from odoo import models, fields, api

class StudentGroup(models.Model):
    _inherit = 'student.group'
    
    manager_id = fields.Many2one('lecturer.lecturer', string='Manager')
    project_course_id = fields.Many2one('project.course', string='Project Course')

    @api.onchange('project_course_id')
    def _onchange_project_course_id(self):
        if self.project_course_id and self.project_course_id.class_ids:
            return {
                'domain': {
                    'class_id': [('id', 'in', self.project_course_id.class_ids.ids)]
                }
            }
        return {
            'domain': {
                'class_id': [('id', '=', False)]
            }
        }
        