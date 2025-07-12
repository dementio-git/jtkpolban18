/** @odoo-module **/

import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { LogbookAnalytics } from "@jtk_logbook_analytics/js/logbook_analytics";
// import { LogbookClassDashboard } from "@jtk_project_analytics/js/logbook_class_dashboard"; // Nonaktifkan jika tidak digunakan

function getRecordIdFromPath() {
  let m = window.location.pathname.match(
    /\/(?:odoo\/)?project-course\/(\d+)(\/|$)/
  );
  if (m) {
    return parseInt(m[1], 10);
  }
  // fallback: cari angka saja di path
  m = window.location.pathname.split("/").find((seg) => /^\d+$/.test(seg));
  return m ? parseInt(m, 10) : null;
}

export class ProjectCourseDashboard extends Component {
  static components = { LogbookAnalytics /*, LogbookClassDashboard */ };

  setup() {
    this.orm = useService("orm");
    this.state = useState({
      projectId: this.props.action.params.project_course_id,
      projectName: "",
      activeTab: "logbook", // Langsung ke tab logbook
    });

    // langsung load nama:
    onMounted(async () => {
      await this.loadProjectName();
    });
  }

  async loadProjectName() {
    // gunakan let, dan fallback ke URL parse kalau this.state.projectId falsy
    let id = this.state.projectId || getRecordIdFromPath();
    if (typeof id === "number" && id > 0) {
      const res = await this.orm.read("project.course", [id], ["name"]);
      this.state.projectName = res?.[0]?.name || "No Name";
    } else {
      console.warn("Tidak menemukan ID proyek.");
      this.state.projectName = "No Name";
    }
  }

  navigate(tab) {
    console.log("🧭 Tab changed to:", tab);
    this.state.activeTab = tab;
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
