### File : services/llm_extraction_service.py

from odoo import models, api
import json
import google.generativeai as genai
import logging

_logger = logging.getLogger(__name__)

class LogbookLLMService(models.AbstractModel):
    _name = 'logbook.llm.service'
    _description = 'Service — build prompt, call Gemini, parse JSON'

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------
    @api.model
    def extract(self, project_course_id, content):
        """Return parsed JSON dict (summary, extracted_aspects, skills)."""
        course = self.env['project.course'].browse(project_course_id)
        if not course.exists():
            raise ValueError('Invalid project_course_id')

        prompt = self._build_prompt(course, content)
        parsed = self._call_llm(prompt)
        return parsed

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------
    def _build_prompt(self, course, content):
        label_objs = course.logbook_label_ids
        label_names = [f'"{lbl.name}"' for lbl in label_objs if lbl.name]
        label_list_str = ', '.join(label_names)

        # --- group by category & rules (preserve original detail) ---
        labels_by_category = {}
        for lbl in label_objs:
            cat = lbl.category_id.name if lbl.category_id else 'Uncategorized'
            labels_by_category.setdefault(cat, []).append(lbl)

        rules_lines = []
        for cat, lbls in labels_by_category.items():
            rules_lines.append(f"\nKategori: {cat}")
            for lbl in lbls:
                line = f'- {lbl.name}';
                if lbl.is_required:
                    line += ' (Wajib dimasukkan)'
                if lbl.description:
                    line += f': {lbl.description.strip()}'
                    if lbl.sub_category_id:
                        line += f' (Sub Kategori: {lbl.sub_category_id.name})'
                if lbl.point_rule_ids:
                    pts = ', '.join(f"{r.point}={r.description}" for r in lbl.point_rule_ids)
                    line += f' (Aturan Poin: {pts})'
                rules_lines.append(line)
        point_rules_str = '\n'.join(rules_lines)

        allowed_skill_groups = self.env['skill.group'].search([]).mapped('name')
        skill_group_str = ', '.join(f'"{g}"' for g in allowed_skill_groups)

        # -------- PROMPT (IDENTIK DENGAN ASLI) --------
        prompt = f"""
Berikut adalah isi logbook mahasiswa:

\"{content}\"

Tugas Anda:
1. Ekstrak isi logbook ke dalam format JSON valid.
2. Gunakan hanya label berikut: {label_list_str}
3. Gunakan deskripsi dan aturan poin dari label-label berikut sebagai acuan klasifikasi:

{point_rules_str}

4. Label dengan aturan \"Wajib dimasukkan\" harus ada di dalam ekstraksi, jika tidak ada berikan poin 0.
5. Suatu bagian / kalimat bisa jadi memiliki lebih dari 1 label atau 1 kategori label.
6. Suatu label bisa memiliki lebih dari 1 bagian / kalimat yang relevan.
7. Identifikasi keterampilan (skill) yang digunakan/dilatih mahasiswa berdasarkan isi logbook.
   Gunakan format:
   - name: nama skill (misal: 'API Integration')
   - type: 'hard' atau 'soft'
   - group: salah satu dari: {skill_group_str}
   - point: 1 s.d. 6 sesuai taksonomi Bloom (Remember=1 s.d. Create=6)
8. Ekstrak kata kunci teknis (lihat pedoman asli).

Format JSON:
{ {
"summary": "...",
"full_text": "...",
"extracted_aspects": [ { { "label": "...", "isi": "...", "keywords": ["..."], "poin": ..., "deskriptor_poin": "..." } } ],
"skills": [ { { "name": "...", "type": "...", "group": "...", "point": ..., "source": "..." } } ]
} }

Berikan hanya JSON valid. Jangan sertakan markdown, komentar, atau penjelasan tambahan.
"""
        return prompt

    def _call_llm(self, prompt):
        api_key = self.env['ir.config_parameter'].sudo().get_param('gemini.api_key') or 'YOUR_GEMINI_KEY'
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(prompt)
        output = response.text.strip()
        if output.startswith('```json'):
            output = output.replace('```json', '').strip()
        if output.endswith('```'):
            output = output[:-3].strip()
        try:
            return json.loads(output)
        except Exception as e:
            _logger.error(f"Error parsing JSON response: {e}")
            raise
