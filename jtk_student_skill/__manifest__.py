# -*- coding: utf-8 -*-
{
    'name': "JTK Student Skill",
    
    'summary': """
        JTK Student Skill""",
        
    'description': """
        JTK Student Skill
    """,
    'author': "KoTA 407 - S.Tr. 2021",
    'website': "https://dementio.id",

    'category': 'JTK',
    'version': '18.0.0.1',

    # any module necessary for this one to work correctly
    'depends': ['base', 'jtk_academic_base'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'views/student_view.xml',
        'views/skill_item_view.xml',
        'views/skill_group_view.xml',
        'views/menuitems.xml',
    ],

}
