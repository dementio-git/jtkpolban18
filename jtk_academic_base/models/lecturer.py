from odoo import models, fields, api

class ResPartner(models.Model):
    _inherit = 'res.partner'

    lecturer_id = fields.Many2one('lecturer.lecturer', string='Lecturer Record')

class Lecturer(models.Model):
    _name = 'lecturer.lecturer'
    _description = 'Lecturer'
    _sql_constraints = [
        ('unique_nip', 'UNIQUE(nip)', 'NIP must be unique!')
    ]
    
    partner_id = fields.Many2one('res.partner', string='Partner ID', required=True, ondelete='cascade')
    name = fields.Char(related='partner_id.name', string='Nama', store=True, readonly=False)
    email = fields.Char(related='partner_id.email', string='Email', store=True, readonly=False)
    phone = fields.Char(related='partner_id.phone', string='Phone', store=True, readonly=False)
    # address = fields.Text(related='partner_id.street', string='Address', store=True, readonly=False)
    
    nip = fields.Char(string='NIP', required=True)
    expertise = fields.Char(string='Expertise')
    active = fields.Boolean(string='Active', default=True)
    
    # # Relational fields can be added based on your needs
    # department = fields.Char(string='Department', default='Teknik Komputer')
    # courses_taught = fields.Many2many('jtk.course', string='Courses Taught')

    # _sql_constraints = [
    #     ('unique_nip', 'UNIQUE(nip)', 'NIP must be unique!')
    # ]

    # @api.model
    # def create(self, vals):
    #     return super(JtkLecturer, self).create(vals)