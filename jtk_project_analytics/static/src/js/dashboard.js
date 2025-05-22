/** @odoo-module **/

import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { LogbookClassDashboard } from "@jtk_logbook_analytics/js/logbook_class_dashboard";

function getRecordIdFromPath() {
  // Match URL pattern: /odoo/project-course/1/... or /project-course/1/...
  let m = window.location.pathname.match(
    /\/(?:odoo\/)?project-course\/(\d+)(\/|$)/
  );
  if (m) return parseInt(m[1], 10);

  // Fallback: find any standalone number (likely the ID) in legacy URL
  m = window.location.pathname.split("/").find((seg) => /^\d+$/.test(seg));
  return m ? parseInt(m, 10) : null;
}

export class ProjectCourseDashboard extends Component {
  static components = { LogbookClassDashboard };
  setup() {
    console.log("📌 Received projectId:", this.props.projectId);
    this.orm = useService("orm");
    this.state = useState({
      projectId: null,
      projectName: "",
      activeTab: "project",
    });

    onMounted(async () => {
      let id = this.env.context?.default_project_course_id;

      if (!id) {
        id = getRecordIdFromPath();
        console.log("📦 Extracted ID from path:", id);
      }

      if (id && !isNaN(id)) {
        this.state.projectId = id;
        await this.loadProjectName();
      } else {
        console.warn("⛔ No valid project ID found in context or URL.");
      }
    });
  }

  /* ------------------------------------------------ */
  async loadProjectName() {
    const id = this.state.projectId;
    if (typeof id === "number" && id > 0) {
      const res = await this.orm.read("project.course", [id], ["name"]);
      this.state.projectName = res?.[0]?.name || "No Name";
    }
  }

  navigate(tab) {
    console.log("🟢 Navigating to:", tab);
    this.state.activeTab = tab;
    console.log("🧭 activeTab now is:", this.state.activeTab);
  }
}

ProjectCourseDashboard.template =
  "jtk_project_analytics.ProjectCourseDashboard";

registry
  .category("actions")
  .add(
    "jtk_project_analytics.project_course_dashboard",
    ProjectCourseDashboard
  );
