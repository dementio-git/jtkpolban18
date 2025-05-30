/** @odoo-module **/

import { Component, useState, onWillStart, onMounted, useEnv } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import * as echarts from "echarts";

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

export class LogbookClassAnalytics extends Component {
  setup() {
    this.orm = useService("orm");
    this.actionService = useService("action");
    this.env = useEnv();
    this.state = useState({
      stats: [],
      weeklyStats: [],
      projectCourseId: null,
    });
    this.echarts = {};

    onWillStart(async () => {
      // 1) Coba ambil dari context default_project_course_id
      let pid = this.props.action?.context?.default_project_course_id;
      // 2) Jika tidak ada, ambil dari URL
      if (!pid) {
        pid = getRecordIdFromPath();
      }
      this.state.projectCourseId = pid;
      // 3) Load data
      await this.loadStats();
      await this.loadWeeklyStats();
    });

    onMounted(() => {
      this.renderCharts();
    });
  }

  async loadWeeklyStats() {
    const pid = this.state.projectCourseId;
    if (!pid) {
      console.warn("projectCourseId belum tersedia");
      this.state.weeklyStats = [];
      return;
    }
    this.state.weeklyStats = await this.orm.searchRead(
      "logbook.weekly.stats.class",
      [["project_course_id", "=", pid]],
      [
        "class_id",
        "class_name",
        "week_start_date",
        "week_end_date",
        "week_label",
        "avg_logbooks_per_week",
        "avg_active_students_per_week",
        "avg_logbooks_per_student_week",
      ]
    );
  }

  async loadStats() {
    const pid = this.state.projectCourseId;
    const [classStats, overallStats] = await Promise.all([
      this.orm.searchRead(
        "logbook.descriptive.stats.class",
        [["project_course_id", "=", pid]],
        [
          "class_name",
          "total_students",
          "total_logbooks",
          "avg_logbooks_per_week",
          "std_dev_logbooks",
          "avg_active_students_per_week",
          "std_dev_active_students_per_week",
          "avg_logbooks_per_student_week",
          "std_dev_logbooks_per_student_week",
        ]
      ),
      this.orm.searchRead(
        "logbook.descriptive.stats",
        [["project_course_id", "=", pid]],
        ["avg_logbooks_per_student_week"]
      ),
    ]);
    this.state.stats = classStats;
    this.state.overall = overallStats[0] || null;
  }

  renderCharts() {
    this.renderClassParticipationChart();
    this.renderClassProductivityChart();
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, "0")}/${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;
  }

  groupByClass() {
    const grouped = {};
    for (const stat of this.state.weeklyStats) {
      const className = stat.class_name;
      if (!grouped[className]) grouped[className] = [];
      grouped[className].push(stat);
    }
    return grouped;
  }

  renderClassParticipationChart() {
    const chartDom = document.getElementById("chart1");
    if (!chartDom) return;
    if (this.echarts.chart1) {
      this.echarts.chart1.dispose();
    }
    const chart = echarts.init(chartDom);

    const grouped = this.groupByClass();
    const weekLabels = [
      ...new Set(
        this.state.weeklyStats
          .sort(
            (a, b) => new Date(a.week_start_date) - new Date(b.week_start_date)
          )
          .map((s) => s.week_label)
      ),
    ];
    const series = Object.entries(grouped).map(([className, stats]) => ({
      name: `Aktif - ${className}`,
      data: stats.map((s) => s.avg_active_students_per_week),
      type: "line",
      smooth: true,
    }));

    chart.setOption({
      title: { text: "Tren Mahasiswa Aktif per Kelas" },
      tooltip: { trigger: "axis" },
      legend: { type: "scroll" },
      xAxis: {
        type: "category",
        name: "Minggu",
        data: weekLabels,
        axisLabel: { interval: 0 },
      },
      yAxis: {
        type: "value",
        name: "Jumlah Mahasiswa",
      },
      series,
    });
    console.log(
      "WEEKLY STATS:",
      this.state.weeklyStats.map((s) => s.week_label)
    );

    this.echarts.chart1 = chart;
  }

  renderClassProductivityChart() {
    const chartDom = document.getElementById("chart2");
    if (!chartDom) return;
    if (this.echarts.chart2) {
      this.echarts.chart2.dispose();
    }
    const chart = echarts.init(chartDom);

    const grouped = this.groupByClass();
    const weekLabels = [
      ...new Set(
        this.state.weeklyStats
          .sort(
            (a, b) => new Date(a.week_start_date) - new Date(b.week_start_date)
          )
          .map((s) => s.week_label)
      ),
    ];

    const series = Object.entries(grouped).map(([className, stats]) => ({
      name: `Produktivitas - ${className}`,
      data: stats.map((s) =>
        parseFloat(s.avg_logbooks_per_student_week.toFixed(2))
      ),
      type: "line",
      smooth: true,
    }));

    // Hitung rata-rata keseluruhan dari seluruh data kelas
    const allValues = this.state.weeklyStats.map(
      (s) => s.avg_logbooks_per_student_week
    );
    const sum = allValues.reduce((a, b) => a + b, 0);
    const overallAvg =
      allValues.length > 0
        ? parseFloat((sum / allValues.length).toFixed(2))
        : 0;

    chart.setOption({
      title: { 
        text: "Tren Produktivitas Logbook per Mahasiswa per Kelas",
      top: 10, },
      tooltip: { trigger: "axis" },
      legend: { type: "scroll" },
      xAxis: {
        type: "category",
        name: "Minggu",
        data: weekLabels,
        axisLabel: { interval: 0 },
      },
      yAxis: {
        type: "value",
        name: "Rata-rata Logbook",
      },
      series: [
        ...series,
        {
          name: "Rata-rata Keseluruhan",
          type: "line",
          data: [],
          markLine: {
            symbol: "none",
            label: {
              formatter: "Rata-rata Keseluruhan\n{c}",
              position: "insideEnd",
            },
            data: [{ yAxis: this.state.overall.avg_logbooks_per_student_week }],
            lineStyle: { type: "dashed", color: "#5470C6" },
          },
        },
      ],
    });
    console.log(
      "WEEKLY STATS:",
      this.state.weeklyStats.map((s) => s.week_label)
    );

    this.echarts.chart2 = chart;
  }
}

LogbookClassAnalytics.template = "jtk_logbook_analytics.LogbookClassAnalytics";
registry
  .category("actions")
  .add("jtk_logbook_analytics.logbook_class_analytics", LogbookClassAnalytics);
