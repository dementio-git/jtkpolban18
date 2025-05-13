# -*- coding: utf-8 -*-
{
    'name': "JTK Logbook Analytics",
    'summary': """
        JTK Logbook Analytics""",
    'description': """
        JTK Logbook Analytics
    """,

    'author': "KoTA 407 - S.Tr. 2021",
    'website': "https://dementio.id",

    'category': 'JTK',
    'version': '18.0.0.1',

    'depends': ['base', 'jtk_logbook_base'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'views/label_analytics_views.xml',
        'views/label_stats_views.xml',
        'views/menuitems.xml',
    ],

}
