# -*- coding: utf-8 -*-
{
    'name': "JTK Logbook Dashboard",
    'summary': """
        JTK Logbook Dashboard""",
    'description': """
        JTK Logbook Dashboard
    """,

    'author': "KoTA 407 - S.Tr. 2021",
    'website': "https://dementio.id",

    'category': 'JTK',
    'version': '18.0.0.1',

    'depends': ['base', 'jtk_logbook_base'],
    
    "assets": {
        "web.assets_backend": [
            "jtk_logbook_dashboard/static/src/**/*",
        ],
        # 'web.qweb': [
        #     'jtk_logbook_dashboard/static/src/xml/dashboard_logbook_template.xml',
        # ],
    },

    # always loaded
    'data': [
        # 'security/ir.model.access.csv',
        'views/dashboard_logbook_template.xml',
        'views/menuitems.xml',
    ],

}
