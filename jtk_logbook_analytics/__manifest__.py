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

    'depends': ['base','web', 'jtk_logbook_base'],
    
    # 'assets': {
    #     'web.assets_backend': [
    #         'jtk_logbook_analytics/static/src/**/*.js',
    #         'jtk_logbook_analytics/static/src/js/lib/*.js',
            
    #         'jtk_logbook_analytics/static/src/**/*.xml',
    #         'jtk_logbook_analytics/static/src/**/*.css',
    #     ],
    # },
    
    # always loaded
    'data': [
        'security/ir.model.access.csv',
        # 'views/assets.xml',
        'views/menuitems.xml',
        # 'views/dashboard_action.xml',
    ],
    
    'assets': {
        'web.assets_backend': [
            'jtk_logbook_analytics/static/src/js/lib/chart.js',
            'jtk_logbook_analytics/static/src/js/lib/echarts.min.js',
            'jtk_logbook_analytics/static/src/js/lib/echarts_shim.js',
            'jtk_logbook_analytics/static/src/js/lib/echarts-wordcloud.js',
            'jtk_logbook_analytics/static/src/js/*.js',
            'jtk_logbook_analytics/static/src/css/*.css',
            'jtk_logbook_analytics/static/src/xml/*.xml',
        ],
    },



}
