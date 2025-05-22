# -*- coding: utf-8 -*-
{
    'name': "JTK Project Course Base",
    'summary': """
        JTK Project Course Base""",
    'description': """
        JTK Project Course Base
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
        'views/project_course_view.xml',
        'views/student_group_view.xml',
        'views/menuitems.xml',

    ],
    
    # 'assets': {
    #     'web.assets_backend': [
    #         'jtk_project_course_base/static/src/js/*.js',
    #         # 'jtk_project_course_base/static/src/css/*.css',
    #         'jtk_project_course_base/static/src/xml/*.xml',
    #     ],
    # },

}
