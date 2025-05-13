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
    
    # 'assets': {
    #     'web.assets_backend': [
    #         'jtk_logbook_analytics/static/src/**/*.js',
    #         'jtk_logbook_analytics/static/src/js/lib/*.js',
            
    #         'jtk_logbook_analytics/static/src/**/*.xml',
    #         'jtk_logbook_analytics/static/src/**/*.css',
    #     ],
    # },
    
    'assets': {
    'web.assets_backend': [
        'jtk_logbook_analytics/static/src/js/lib/chart.js',
        'jtk_logbook_analytics/static/src/js/dashboard.js',
        'jtk_logbook_analytics/static/src/css/dashboard.css',
        'jtk_logbook_analytics/static/src/xml/dashboard.xml',
    ],
},


    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'views/label_analytics_views.xml',
        'views/label_stats_views.xml',
        'views/student_progress_view.xml',
        'views/menuitems.xml',
        # 'views/dashboard_action.xml',
    ],

}
