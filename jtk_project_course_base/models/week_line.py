from odoo import models, fields, api

class WeekLine(models.Model):
    _name = 'week.line'
    _description = 'Week Line'
    
    name = fields.Char(string='Week Name', required=True)
    course_id = fields.Many2one('project.course', string='Course', ondelete='cascade')
    start_date = fields.Date(string='Start Date')
    end_date = fields.Date(string='End Date')