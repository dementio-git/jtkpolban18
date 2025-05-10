from odoo import models, fields, api
import json
import google.generativeai as genai
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)

class Logbook(models.Model):
    _name = 'logbook.logbook'
    _description = 'Logbook'

    name = fields.Char(string='Kode Logbook', compute='_compute_name', store=True)
    student_id = fields.Many2one('student.student', string='Nama Mahasiswa')
    project_course_id = fields.Many2one('project.course', string='Mata Kuliah')
    week = fields.Selection([
        ('1', 'W1'),
        ('2', 'W2'),
        ('3', 'W3'),
        ('4', 'W4'),
        ('5', 'W5'),
        ('6', 'W6'),
        ('7', 'W7'),
        ('8', 'W8'),
        ('9', 'W9'),
        ('10', 'W10'),
        ('11', 'W11'),
        ('12', 'W12'),
        ('13', 'W13'),
        ('14', 'W14'),
        ('ets', 'ETS'),
        ('eas', 'EAS'),
    ], string='Minggu Ke-')
    logbook_date = fields.Date(string='Tanggal Logbook')
    logbook_content = fields.Text(string='Isi Logbook')
    logbook_summary = fields.Text(string='Ringkasan Logbook')
    logbook_keyword_ids = fields.One2many('logbook.keyword', 'logbook_id', string='Keyword')
    logbook_extraction_ids = fields.One2many('logbook.extraction', 'logbook_id', string='Logbook Extraction')
    skill_extraction_ids = fields.One2many('skill.extraction', 'logbook_id', string='Skill Extraction')
    
    @api.depends('week', 'student_id')
    def _compute_name(self):
        for record in self:
            if record.week and record.student_id.name:
                record.name = f"{record.week}-{record.student_id.name}"
            else:
                record.name = False

    # Finalized extract_logbook function with skill integration, level handling, and validation

    def extract_logbook(self):
        for record in self:
            if not record.logbook_content:
                continue

            genai.configure(api_key="AIzaSyBZ1pYWJmkTYx1vR4RoPi9jUcd9wat25-w")
            model = genai.GenerativeModel("gemini-2.5-pro-exp-03-25")

            label_objs = record.project_course_id.logbook_label_ids
            label_names = [f'"{label.name}"' for label in label_objs if label.name]
            label_list_str = ", ".join(label_names)

            label_rules = []
            for label in label_objs:
                if not label.description:
                    continue
                rule_line = f'- {label.name}: {label.description.strip()}'
                if label.has_point and label.points_rule:
                    rule_line += f' (Aturan Poin: {label.points_rule.strip()})'
                if label.level_ids:
                    level_names = label.level_ids.mapped("name")
                    rule_line += f'\n  Level yang diperbolehkan: {", ".join(level_names)}'
                label_rules.append(rule_line)
            point_rules_str = "\n".join(label_rules)

            allowed_skill_groups = self.env['skill.group'].search([]).mapped("name")
            skill_group_str = ", ".join(f'"{g}"' for g in allowed_skill_groups)

            # === Prompt ke LLM ===
            prompt = f"""
Berikut adalah isi logbook mahasiswa:

\"{record.logbook_content}\"

Tugas Anda:
1. Ekstrak isi logbook ke dalam format JSON valid.
2. Gunakan hanya label berikut: {label_list_str}
3. Gunakan deskripsi dan aturan poin dari label-label berikut sebagai acuan klasifikasi:

{point_rules_str}

4. Identifikasi keterampilan (skill) yang digunakan/dilatih mahasiswa berdasarkan isi logbook. Gunakan format:
- name: nama skill (misal: 'API Integration')
- type: 'hard' atau 'soft'
- group: salah satu dari: {skill_group_str}
- point: 1 s.d. 6 sesuai taksonomi Bloom (Remember=1 s.d. Create=6)

Format JSON:
{{
"summary": "...",
"full_text": "...",
"keywords": ["..."],
"extracted_aspects": [
    {{
    "label": "...",
    "isi": "...",
    "keywords": ["...", "..."],
    "level": "...",
    "poin": ...
    }}
],
"skills": [
    {{
    "name": "...",
    "type": "...",
    "group": "...",
    "point": ...,
    "source": "..."
    }}
]
}}

Berikan hanya JSON valid. Jangan sertakan markdown, komentar, atau penjelasan tambahan.
"""

            try:
                response = model.generate_content(prompt)
                output = response.text.strip()
                if output.startswith("```json"):
                    output = output.replace("```json", "").strip()
                if output.endswith("```"):
                    output = output[:-3].strip()
                parsed = json.loads(output)
            except Exception as e:
                raise UserError(f"Ekstraksi gagal:\n{e}")

            record.logbook_summary = parsed.get("summary")
            record.logbook_extraction_ids.unlink()
            record.logbook_keyword_ids.unlink()
            record.skill_extraction_ids.unlink()

            for kw in parsed.get("keywords", []):
                self.env['logbook.keyword'].create({
                    'name': kw.strip(),
                    'logbook_id': record.id
                })

            for aspect in parsed.get("extracted_aspects", []):
                label = self.env['logbook.label'].search([('name', '=', aspect.get("label"))], limit=1)
                level_name = aspect.get("level")
                level_ids = self.env['logbook.label.level'].search([('name', '=', level_name)]).ids if level_name else []

                extraction = self.env['logbook.extraction'].create({
                    'logbook_id': record.id,
                    'label_id': label.id if label else False,
                    'content': aspect.get("isi"),
                    'point': aspect.get("poin") or 0.0,
                    'level_ids': [(6, 0, level_ids)]
                })

                for kw in aspect.get("keywords", []):
                    self.env['logbook.keyword'].create({
                        'name': kw.strip(),
                        'logbook_extraction_id': extraction.id
                    })

            # === Simpan Skill Extraction (jika skill group valid dan skill sudah ada)
            for skill in parsed.get("skills", []):
                skill_name = skill.get("name")
                skill_group_name = skill.get("group")
                skill_point = int(skill.get("point", 0))

                if skill_group_name not in allowed_skill_groups:
                    _logger.warning(f"Skill group '{skill_group_name}' tidak valid. Dilewati.")
                    continue

                skill_item = self.env['skill.item'].search([('name', 'ilike', skill_name)], limit=1)
                if not skill_item:
                    skill_group_rec = self.env['skill.group'].search([('name', '=', skill_group_name)], limit=1)
                    skill_item = self.env['skill.item'].create({
                        'name': skill_name,
                        'skill_group_id': skill_group_rec.id if skill_group_rec else False
                    })

                self.env['skill.extraction'].create({
                    'student_id': record.student_id.id,
                    'skill_item_id': skill_item.id,
                    'skill_point': skill_point,
                    'logbook_id': record.id,
                    'content': skill.get("source", ""),  # ambil potongan kutipan yang relevan
                })
