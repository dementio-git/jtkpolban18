from odoo import models, fields, api

class CourseActivity(models.Model):
    _name = 'course.activity'
    _description = 'Course Activity'
    _parent_store = True  # Enable hierarchy support
    
    name = fields.Char(string='Nama Event', required=True)
    description = fields.Text(string='Deskripsi')
    course_id = fields.Many2one('project.course', string='Project Course', ondelete='cascade', required=True)
    
    # Hierarchy fields
    parent_id = fields.Many2one('course.activity', string='Parent Event', 
                               domain="[('course_id', '=', course_id)]")
    parent_id_domain = fields.Char(compute='_compute_parent_domain', string='Parent Domain')
    parent_path = fields.Char(index=True)
    child_ids = fields.One2many('course.activity', 'parent_id', string='Sub Events')
    
    week_ids = fields.One2many(
        'course.activity', 'parent_id',
        domain=[('type', '=', 'week')],
        string='Weeks'
    )

    subactivity_ids = fields.One2many(
        'course.activity', 'parent_id',
        domain=[('type', 'not in', ['milestone', 'week'])],
        string='Sub Activities'
    )
    
    # Dates
    start_date = fields.Date(string='Tanggal Mulai')
    end_date = fields.Date(string='Tanggal Selesai')
    
    deadline = fields.Datetime(string='Batas Waktu')
    
    assessment_id = fields.Many2one('assessment.assessment', string='Assessment')
    
    type = fields.Selection([
        ('milestone', 'Milestone'),   # Top level
        ('week', 'Week'),            # Container under milestone
        ('assignment', 'Pengumpulan Tugas'),  # Events under week
        ('presentation', 'Presentasi'),
        ('assessment', 'Assessment'),
        ('meeting', 'Pertemuan'),
        ('other', 'Lainnya'),
    ], string='Tipe', required=True)    
    
    assessment_id = fields.Many2one('assessment.assessment', string='Assessment', 
                                  domain="[('type', 'in', ['pretest', 'posttest', 'exam', 'quiz'])]")
    
    # Computed dates based on child records
    @api.depends('child_ids.start_date', 'child_ids.end_date')
    def _compute_dates(self):
        for record in self:
            if record.child_ids:
                start_dates = [c.start_date for c in record.child_ids if c.start_date]
                end_dates = [c.end_date for c in record.child_ids if c.end_date]
                
                if start_dates:
                    record.start_date = min(start_dates)
                if end_dates:
                    record.end_date = max(end_dates)
    
    # Validation rules
    @api.constrains('parent_id', 'type', 'course_id')
    def _check_hierarchy(self):
        for record in self:
            if record.type == 'milestone' and record.parent_id:
                raise models.ValidationError('Milestone tidak boleh memiliki parent')
                
            if record.parent_id:
                # Check course consistency
                if record.course_id != record.parent_id.course_id:
                    raise models.ValidationError('Parent event harus berada dalam course yang sama')
                
                # Check hierarchy rules
                if record.type == 'week' and record.parent_id.type != 'milestone':
                    raise models.ValidationError('Week hanya boleh berada di bawah milestone')
                    
                if record.type not in ['milestone', 'week'] and record.parent_id.type != 'week':
                    raise models.ValidationError('Event harus berada di bawah week')
    
    
    # Dynamic domain for parent_id
    @api.depends('type')
    def _compute_parent_domain(self):
        for record in self:
            domain = [('course_id', '=', record.course_id.id)]
            if record.type == 'milestone':
                domain.append(('type', '=', 'milestone'))
            elif record.type == 'week':
                domain.append(('type', '=', 'milestone'))
            else:
                domain.append(('type', 'in', ['week', 'milestone']))
            record.parent_id_domain = str(domain)
            
            
    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        # Check if this is being created as a child event
        parent_id = self._context.get('default_parent_id')
        if parent_id:
            parent = self.env['course.activity'].browse(parent_id)
            res.update({
                'start_date': parent.start_date,
                'course_id': parent.course_id.id
            })
        return res