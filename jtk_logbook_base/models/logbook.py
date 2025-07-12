# jtkpolban18\jtk_logbook_base\models\logbook.py

from odoo import models, fields, api
import json
import google.generativeai as genai
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)

class Logbook(models.Model):
    _name = 'logbook.logbook'
    _description = 'Logbook'

    name = fields.Char(string='Kode Logbook', compute='_compute_name',store=True)
    student_id = fields.Many2one('student.student', string='Nama Mahasiswa')
    project_course_id = fields.Many2one('project.course', string='Mata Kuliah')
    week_id = fields.Many2one('course.activity', string='Minggu Ke-', 
                             domain="[('course_id', '=', project_course_id), ('type', '=', 'week')]",
                             compute='_compute_week', store=True)
    logbook_date = fields.Date(string='Tanggal Logbook')
    logbook_content = fields.Text(string='Isi Logbook')
    logbook_summary = fields.Text(string='Ringkasan Logbook')
    logbook_keyword_ids = fields.One2many('logbook.keyword', 'logbook_id', string='Keyword')
    logbook_extraction_ids = fields.One2many('logbook.extraction', 'logbook_id', string='Logbook Extraction')
    skill_extraction_ids = fields.One2many('skill.extraction', 'logbook_id', string='Skill Extraction')
    is_extracted = fields.Boolean(string='Sudah diekstrak', default=False)
            
    
    @api.depends('week_id', 'student_id')
    def _compute_name(self):
        for record in self:
            if record.week_id and record.student_id.name:
                record.name = f"{record.week_id.name}-{record.student_id.name}"
            else:
                record.name = False
                
    @api.depends('logbook_date', 'project_course_id')
    def _compute_week(self):
        for record in self:
            if record.logbook_date and record.project_course_id:
                week = self.env['course.activity'].search([
                    ('start_date', '<=', record.logbook_date),
                    ('end_date', '>=', record.logbook_date),
                    ('course_id', '=', record.project_course_id.id),
                    ('type', '=', 'week')
                ], limit=1)
                record.week_id = week.id if week else False
            else:
                record.week_id = False

    # Finalized extract_logbook function with skill integration, level handling, and validation
    def extract_logbook(self):
        """Delegasi ke service untuk LLM; sisanya tetap sama."""
        for rec in self:
            if not rec.logbook_content:
                continue  # tidak ada konten – skip

            try:
                # --- 1. panggil service untuk LLM & parsing JSON
                parsed = self.env['logbook.llm.service'].extract(
                    project_course_id=rec.project_course_id.id,
                    content=rec.logbook_content,
                )
            except Exception as e:
                _logger.error(f"LLM extraction error for Logbook {rec.id}: {e}")
                continue

            # --- 2. update summary & bersihkan data lama
            rec.logbook_summary = parsed.get('summary')
            rec.logbook_extraction_ids.unlink()
            rec.logbook_keyword_ids.unlink()
            rec.skill_extraction_ids.unlink()

            # --- 3. proses aspek + keyword sama persis dengan kode asli
            for aspect in parsed.get('extracted_aspects', []):
                label = self.env['logbook.label'].search([('name', '=', aspect.get('label'))], limit=1)
                extraction = self.env['logbook.extraction'].create({
                    'logbook_id': rec.id,
                    'label_id': label.id if label else False,
                    'content': aspect.get('isi'),
                    'level': aspect.get('deskriptor_poin') or '',
                    'point': aspect.get('poin') or 0.0,
                })
                for kw in aspect.get('keywords', []):
                    self.env['logbook.keyword'].create({
                        'name': kw.strip(),
                        'logbook_extraction_id': extraction.id,
                    })

            # --- 4. simpan keyword unik (tidak berubah)
            unique_kws = set()
            for aspect in parsed.get('extracted_aspects', []):
                for kw in aspect.get('keywords', []):
                    if kw.strip() not in unique_kws:
                        unique_kws.add(kw.strip())
                        self.env['logbook.keyword'].create({
                            'name': kw.strip(),
                            'logbook_id': rec.id,
                        })

            # --- 5. skill extraction (algoritma asli tetap)
            allowed_groups = self.env['skill.group'].search([]).mapped('name')
            for skill in parsed.get('skills', []):
                grp = skill.get('group')
                if grp not in allowed_groups:
                    _logger.warning(f"Skill group '{grp}' tidak valid – dilewati.")
                    continue
                item = self.env['skill.item'].search([('name', 'ilike', skill.get('name'))], limit=1)
                if not item:
                    grp_rec = self.env['skill.group'].search([('name', '=', grp)], limit=1)
                    item = self.env['skill.item'].create({
                        'name': skill.get('name'),
                        'skill_group_id': grp_rec.id if grp_rec else False,
                    })
                self.env['skill.extraction'].create({
                    'student_id': rec.student_id.id,
                    'skill_item_id': item.id,
                    'skill_point': int(skill.get('point', 0)),
                    'logbook_id': rec.id,
                    'content': skill.get('source', ''),
                })

            rec.is_extracted = True
            _logger.info(f"Logbook {rec.student_id.name} tanggal {rec.logbook_date} berhasil diekstrak.")