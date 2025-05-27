# -*- coding: utf-8 -*-
{
    'name': "JTK Project Course Analytics",
    'summary': """
        JTK Project Course Analytics""",
    'description': """
        JTK Project Course Analytics
    """,
    
    'author': "KoTA 407 - S.Tr. 2021",
    'website': "https://dementio.id",

    'category': 'JTK',
    'version': '18.0.0.1',

    # any module necessary for this one to work correctly
    'depends': ['base'],

    # any module necessary for this one to work correctly
    'depends': ['base', 'jtk_project_course_base', 'jtk_academic_base', 'jtk_logbook_analytics'],

    # always loaded
    'data': [
        # 'security/ir.model.access.csv',
        'views/project_course_view.xml',
    ],
    
    'assets': {
        'web.assets_backend': [
            'jtk_project_analytics/static/src/js/*.js',
            # # 'jtk_project_analytics/static/src/css/*.css',
            'jtk_project_analytics/static/src/xml/*.xml',
        ],
    },
}
