/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { LogbookProjectAnalytics } from "@jtk_logbook_analytics/js/logbook_project_analytics";
import { LogbookClassAnalytics } from "@jtk_logbook_analytics/js/logbook_class_analytics";
import { LogbookStudentAnalytics } from "@jtk_logbook_analytics/js/logbook_student_analytics";
import { registry } from "@web/core/registry";


export class LogbookAnalytics extends Component {
    static components = {
        LogbookProjectAnalytics,
        LogbookClassAnalytics,
        LogbookStudentAnalytics,
    };

    setup() {
        this.state = useState({
            viewMode: "project", // default
        });

        this.onChangeViewMode = (ev) => {
            this.state.viewMode = ev.target.value;
        };
    }

    get currentComponent() {
        switch (this.state.viewMode) {
            case "class":
                return LogbookClassAnalytics;
            case "student":
                return LogbookStudentAnalytics;
            default:
                return LogbookProjectAnalytics;
        }
    }

}



LogbookAnalytics.template = "jtk_logbook_analytics.LogbookAnalytics";
registry
  .category("actions")
  .add("jtk_logbook_analytics.logbook_analytics", LogbookAnalytics);
