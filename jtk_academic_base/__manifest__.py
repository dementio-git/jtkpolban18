# -*- coding: utf-8 -*-
{
    'name': "JTK Academic Base",
    'summary': """
        JTK Academic Base""",
    'description': """
        JTK Academic Base
    """,

    'author': "KoTA 407 - S.Tr. 2021",
    'website': "https://dementio.id",

    'category': 'JTK',
    'version': '18.0.0.1',

    # any module necessary for this one to work correctly
    'depends': ['base'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'views/class_view.xml',
        'views/lecturer_view.xml',
        'views/student_view.xml',
        'views/study_program_view.xml',
        'views/subject_view.xml',
        'views/project_course_view.xml',
        'views/menuitems.xml',
    ],
}
