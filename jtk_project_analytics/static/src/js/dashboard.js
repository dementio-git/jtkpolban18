/** @odoo-module **/

import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { LogbookAnalytics } from "@jtk_logbook_analytics/js/logbook_analytics";
// import { LogbookClassDashboard } from "@jtk_project_analytics/js/logbook_class_dashboard"; // Nonaktifkan jika tidak digunakan

function getRecordIdFromPath() {
    let m = window.location.pathname.match(/\/(?:odoo\/)?project-course\/(\d+)(\/|$)/);
    if (m) return parseInt(m[1], 10);

    m = window.location.pathname.split("/").find((seg) => /^\d+$/.test(seg));
    return m ? parseInt(m, 10) : null;
}

export class ProjectCourseDashboard extends Component {
    static components = { LogbookAnalytics /*, LogbookClassDashboard */ };

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            projectId: null,
            projectName: "",
            activeTab: "logbook", // Langsung ke tab logbook
        });

        onMounted(async () => {
            let id = this.env.context?.default_project_course_id || getRecordIdFromPath();
            if (id && !isNaN(id)) {
                this.state.projectId = id;
                await this.loadProjectName();
            } else {
                console.warn("⛔ No valid project ID found.");
            }
        });
    }

    async loadProjectName() {
        const id = this.state.projectId;
        if (typeof id === "number" && id > 0) {
            const res = await this.orm.read("project.course", [id], ["name"]);
            this.state.projectName = res?.[0]?.name || "No Name";
        }
    }

    navigate(tab) {
        console.log("🧭 Tab changed to:", tab);
        this.state.activeTab = tab;
    }
}

ProjectCourseDashboard.template = "jtk_project_analytics.ProjectCourseDashboard";

registry
  .category("actions")
  .add("jtk_project_analytics.project_course_dashboard", ProjectCourseDashboard);
