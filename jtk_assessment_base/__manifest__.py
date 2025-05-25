# -*- coding: utf-8 -*-
{
    'name': "JTK Assessment Base",
    'summary': """
        JTK Assessment Base""",
    'description': """
        JTK Assessment Base
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
        'views/assessment_view.xml',
    ],
}
