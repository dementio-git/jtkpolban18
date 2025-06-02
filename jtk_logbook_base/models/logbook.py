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
        for record in self:
            if not record.logbook_content:
                continue

            genai.configure(api_key="AIzaSyBfwRw6VIr1nKHPqFzDo556OySn0UebmF0")
            model = genai.GenerativeModel("gemini-2.0-flash")

            label_objs = record.project_course_id.logbook_label_ids
            label_names = [f'"{label.name}"' for label in label_objs if label.name]
            label_list_str = ", ".join(label_names)

            # Group labels by category
            labels_by_category = {}
            for label in label_objs:
                category_name = label.category_id.name if label.category_id else 'Uncategorized'
                if category_name not in labels_by_category:
                    labels_by_category[category_name] = []
                labels_by_category[category_name].append(label)

            # Build rules string by category
            label_rules = []
            for category, labels in labels_by_category.items():
                label_rules.append(f"\nKategori: {category}")
                for label in labels:
                    rule_line = f'- {label.name}'
                    if label.is_required:
                        rule_line += ' (Wajib dimasukkan)'
                        
                    if label.description:
                        rule_line += f': {label.description.strip()}'
                        if label.sub_category_id:
                            rule_line += f' (Sub Kategori: {label.sub_category_id.name})'
                        if label.points_rule:
                            rule_line += f' (Aturan Poin: {label.points_rule.strip()})'
                    
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

4. Label dengan aturan "Wajib dimasukkan" harus ada di dalam ekstraksi, jika tidak ada berikan poin 0.

5. Suatu bagian / kalimat bisa jadi memiliki lebih dari 1 label atau 1 kategori label. 

6. Suatu label bisa memiliki lebih dari 1 bagian / kalimat yang relevan.

7. Identifikasi keterampilan (skill) yang digunakan/dilatih mahasiswa berdasarkan isi logbook. Gunakan format:
- name: nama skill (misal: 'API Integration')
- type: 'hard' atau 'soft'
- group: salah satu dari: {skill_group_str}
- point: 1 s.d. 6 sesuai taksonomi Bloom (Remember=1 s.d. Create=6)

8. Ekstrak kata kunci teknis
- Pilih 1 frase yang mewakili konsep inti.
- Harus berupa kata benda atau kata kerja teknis, bukan narasi.
- Abaikan kata bantu/abstrak (mis. “mencoba”, “belajar”, “akan”).
- Contoh valid: “Micro Frontend”, “error 403”, “OpenEdX”.
- Contoh tidak valid: “belajar micro frontend”, “lesson learned”.

Format array JSON:
"keywords": ["...", "...", "..."]


Format JSON:
{{
"summary": "...",
"full_text": "...",
"extracted_aspects": [
    {{
    "label": "...",
    "isi": "...",
    "keywords": ["...", "..."],
    "poin": ...,
    "deskriptor_poin": "...", (yang ada di sebelah kanan poin, contoh "-2 = 'Sangat Kecewa'. Nah kata 'Sangat Kecewa' deskriptor poinnya)
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
                _logger.error(f"Error parsing JSON response: {e}")
                continue

            record.logbook_summary = parsed.get("summary")
            record.logbook_extraction_ids.unlink()
            record.logbook_keyword_ids.unlink()
            record.skill_extraction_ids.unlink()


            for aspect in parsed.get("extracted_aspects", []):
                label = self.env['logbook.label'].search([('name', '=', aspect.get("label"))], limit=1)

                extraction = self.env['logbook.extraction'].create({
                    'logbook_id': record.id,
                    'label_id': label.id if label else False,
                    'content': aspect.get("isi"),
                    'level': aspect.get("deskriptor_poin") or "",
                    'point': aspect.get("poin") or 0.0,
                })

                for kw in aspect.get("keywords", []):
                    self.env['logbook.keyword'].create({
                        'name': kw.strip(),
                        'logbook_extraction_id': extraction.id
                    })
                    
            # === Simpan Keyword Ekstraksi hanya keyword yang unique
            unique_keywords = set()
            for aspect in parsed.get("extracted_aspects", []):
                for kw in aspect.get("keywords", []):
                    if kw.strip() not in unique_keywords:
                        unique_keywords.add(kw.strip())
                        self.env['logbook.keyword'].create({
                            'name': kw.strip(),
                            'logbook_id': record.id
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
                
            record.is_extracted = True
            _logger.info(f"Logbook {record.student_id.name} tanggal {record.logbook_date} berhasil diekstrak.")
