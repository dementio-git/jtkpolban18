# jtkpolban18\jtk_project_analytics\models\project_course.py

from odoo import models, fields, api


class ProjectCourse(models.Model):
    _inherit = 'project.course'

    def open_project_course_dashboard(self):
        self.ensure_one()
        action = self.env.ref("jtk_project_analytics.action_project_dashboard").read()[0]
        # tambahkan baris ini:
        action['params'] = {'project_course_id': self.id}
        return action