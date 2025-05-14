/** @odoo-module */

import { Component, useRef, useState, onWillStart, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class LogbookDashboard extends Component {
  setup() {
    this.orm = useService("orm");
    this.state = useState({
      projects: [],
      weeks: [],
      selectedProjectId: null,
      selectedWeekId: null,
      data: [],
    });
    this.barChartRef = useRef("barChartRef");
    this.chartInstance = null;

    onWillStart(async () => {
      this.state.projects = await this.orm.searchRead("project.course", [], ["name"]);
    });
  }

  async onProjectChange(ev) {
    const projectId = parseInt(ev.target.value) || null;
    this.state.selectedProjectId = projectId;
    this.state.selectedWeekId = null;
    this.state.data = [];
    if (projectId) {
      this.state.weeks = await this.orm.searchRead(
        "week.line",
        [["course_id", "=", projectId]],
        ["name"]
      );
    } else {
      this.state.weeks = [];
    }
  }

  async onWeekChange(ev) {
    const weekId = parseInt(ev.target.value) || null;
    this.state.selectedWeekId = weekId;
    this.state.data = [];

    if (this.state.selectedProjectId && weekId) {
      const result = await this.orm.searchRead(
        "logbook.label.analytics",
        [
          ["project_course_id", "=", this.state.selectedProjectId],
          ["week_id", "=", weekId],
        ],
        ["label_id", "class_id", "total_point"]
      );
      this.state.data = result;
      // langsung render—karena t-ref udah bener, barChartRef.el pasti ada
      this._renderChart();
    }
  }

  _renderChart() {
    const canvas = this.barChartRef.el;
    if (!canvas) {
        console.error("Canvas tidak ditemukan!");
        return;
    }

    const ctx = canvas.getContext("2d");

    // ✅ Ini dia baris yang sudah benar
    if (this.chartInstance) {
        this.chartInstance.destroy();  // ini mencegah chart tumpuk dan ukuran error
    }
    // bersihin chart sebelumnya
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
    // kumpulkan data
    const byClass = {};
    const labels = [];
    for (const r of this.state.data) {
      const lbl = r.label_id[1] || "Unknown";
      const cls = r.class_id[1] || "Unknown";
      byClass[cls] = byClass[cls] || {};
      byClass[cls][lbl] = (byClass[cls][lbl] || 0) + (r.total_point || 0);
      if (!labels.includes(lbl)) {
        labels.push(lbl);
      }
    }
    const classNames = Object.keys(byClass);
    const datasets = classNames.map((cls, idx) => ({
      label: cls,
      data: labels.map(l => byClass[cls][l] || 0),
      backgroundColor: `hsl(${(idx * 60) % 360},70%,60%)`,
    }));

    this.chartInstance = new window.Chart(ctx, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
            mode: 'index',
            position: 'nearest',
            intersect: false,
            },
            legend: { position: "top" },
            title: { display: true, text: "Total Poin per Kelas" },
        },
        scales: {
            x: { stacked: false },
            y: { stacked: false, beginAtZero: true }
        },
        },
    });
  }
}

LogbookDashboard.template = "jtk_logbook_analytics.LogbookDashboard";
registry.category("actions").add("jtk_logbook_analytics.logbook_dashboard", LogbookDashboard);
