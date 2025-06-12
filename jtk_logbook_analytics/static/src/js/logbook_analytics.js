/** @odoo-module **/

import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { LogbookProjectAnalytics } from "@jtk_logbook_analytics/js/logbook_project_analytics";
import { LogbookClassAnalytics } from "@jtk_logbook_analytics/js/logbook_class_analytics";
import { LogbookStudentAnalytics } from "@jtk_logbook_analytics/js/logbook_student_analytics";

export class LogbookAnalytics extends Component {}

LogbookAnalytics.template = "jtk_logbook_analytics.LogbookAnalytics";
LogbookAnalytics.components = {
    LogbookProjectAnalytics,
    LogbookClassAnalytics,
    LogbookStudentAnalytics,
};

registry
  .category("actions")
  .add("jtk_logbook_analytics.logbook_analytics", LogbookAnalytics);
