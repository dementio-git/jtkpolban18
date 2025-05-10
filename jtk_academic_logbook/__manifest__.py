# -*- coding: utf-8 -*-
{
    'name': "JTK PJBL Logbook",
    'summary': """
        JTK PJBL Logbook""",
    'description': """
        JTK PJBL Logbook
    """,

    'author': "KoTA 407 - S.Tr. 2021",
    'website': "https://dementio.id",

    'category': 'JTK',
    'version': '18.0.0.1',

    # any module necessary for this one to work correctly
    'depends': ['base', 'jtk_academic_base', 'jtk_student_skill'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'views/logbook_view.xml',
        'views/logbook_label_view.xml',
        'views/project_course_view.xml',
        'views/menuitems.xml',
    ],
    
    'application': True,
    'installable': True,
}
