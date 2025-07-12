# jtkpolban18\jtk_logbook_base\models\project_course.py

from odoo import models, fields

class ProjectCourse(models.Model):
    _inherit = 'project.course'
    
    logbook_label_ids = fields.Many2many(
        'logbook.label',
        string='Logbook Labels'
    )
    
    point_coefficient = fields.Float(
        string='Coefficient For Point',
        help='Coefficient for calculating points in logbook'
    )
    
    frequency_coefficient = fields.Float(
        string='Coefficient For Frequency',
        help='Coefficient for calculating frequency in logbook'
    )
    
    alpha = fields.Float(
        string="Bobot Kesamaan Berdasarkan Kata",
        default=0.5,
        help="Tentukan seberapa besar kemiripan logbook dihitung berdasarkan kemiripan kata. Nilai lebih tinggi akan lebih menekankan kesamaan kata (tekstual), sedangkan nilai lebih rendah lebih menekankan kesamaan makna (kontekstual)."
    )
        
    logbook_clustering_x_axis_name = fields.Char(
        string='X-Axis Name for Clustering',
        help='Name for the X-axis in clustering visualizations'
    )
    logbook_clustering_x_axis_label_ids = fields.Many2many(
        'logbook.label',
        'project_course_x_axis_label_rel',
        'project_course_id',
        'label_id',
        string='X-Axis Labels for Clustering',
        help='Labels used for clustering on the X-axis'
    )
    
    logbook_clustering_y_axis_name = fields.Char(
        string='Y-Axis Name for Clustering',
        help='Name for the Y-axis in clustering visualizations'
    )
    logbook_clustering_y_axis_label_ids = fields.Many2many(
        'logbook.label',
        'project_course_y_axis_label_rel', 
        'project_course_id',
        'label_id',
        string='Y-Axis Labels for Clustering',
        help='Labels used for clustering on the Y-axis'
    )
    
    