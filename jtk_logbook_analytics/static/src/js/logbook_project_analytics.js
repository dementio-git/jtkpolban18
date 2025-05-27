/** @odoo-module **/

import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import * as echarts from "echarts";

export class LogbookProjectAnalytics extends Component {
  setup() {
    this.state = useState({
      stats: [],
      weeklyStats: [],
    });
    this.orm = useService("orm");
    this.echarts = {};

    onWillStart(async () => {
      await this.loadStats();
      await this.loadWeeklyStats();
    });

    onMounted(() => {
      this.renderCharts();
    });
  }

  async loadStats() {
    this.state.stats = await this.orm.searchRead(
      "logbook.descriptive.stats",
      [],
      [
        "project_course_id",
        "total_students",
        "total_logbooks",
        "avg_logbooks_per_week",
        "std_dev_logbooks",
        "avg_active_students_per_week",
        "std_dev_active_students_per_week",
        "avg_logbooks_per_student_week",
        "std_dev_logbooks_per_student_week",
      ]
    );
  }

  async loadWeeklyStats() {
    this.state.weeklyStats = await this.orm.searchRead(
      "logbook.weekly.stats",
      [],
      [
        "week_start_date",
        "week_end_date",
        "avg_logbooks_per_week",
        "avg_active_students_per_week",
        "avg_logbooks_per_student_week",
      ]
    );
  }

  renderCharts() {
    this.renderParticipationTrendChart();
    this.renderProductivityTrendChart();
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;
  }

  renderParticipationTrendChart() {
    const chartDom = document.getElementById("chart1");
    if (!chartDom) return;

    const chart = echarts.init(chartDom);
    const weekly = this.state.weeklyStats;
    const overall = this.state.stats.length ? this.state.stats[0] : {};

    chart.setOption({
      title: { text: "Tren Waktu Logbook" },
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          const index = params[0].dataIndex;
          const s = this.state.weeklyStats[index];
          const items = params
            .map((p) => `${p.marker} ${p.seriesName}: ${p.value}`)
            .join("<br>");
          return `Minggu ${index + 1} (${this.formatDate(s.week_start_date)} - ${this.formatDate(s.week_end_date)})<br>${items}`;
        },
      },
      legend: {
        data: ["Jumlah Logbook", "Mahasiswa Aktif"],
      },
      xAxis: {
        type: "category",
        name: "Minggu",
        data: weekly.map((_, i) => `W${i + 1}`),
        axisLabel: { interval: 0 },
      },
      yAxis: {
        type: "value",
        name: "Nilai",
      },
      series: [
        {
          name: "Jumlah Logbook",
          data: weekly.map((s) => s.avg_logbooks_per_week),
          type: "line",
          smooth: true,
          markLine: {
            symbol: "none",
            label: {
              formatter: "Rata-rata Logbook/Minggu\n{c}",
              position: "insideEnd",
            },
            data: [{ yAxis: overall.avg_logbooks_per_week }],
            lineStyle: { type: "dashed", color: "#5470C6" },
          },
        },
        {
          name: "Mahasiswa Aktif",
          data: weekly.map((s) => s.avg_active_students_per_week),
          type: "line",
          smooth: true,
          markLine: {
            symbol: "none",
            label: {
              formatter: "Rata-rata Mahasiswa Aktif\n{c}",
              position: "insideEnd",
            },
            data: [{ yAxis: overall.avg_active_students_per_week }],
            lineStyle: { type: "dashed", color: "#91CC75" },
          },
        },
      ],
    });

    this.echarts.chart1 = chart;
  }

  renderProductivityTrendChart() {
    const chartDom = document.getElementById("chart2");
    if (!chartDom) return;

    const chart = echarts.init(chartDom);
    const weekly = this.state.weeklyStats;
    const overall = this.state.stats.length ? this.state.stats[0] : {};

    chart.setOption({
      title: { text: "Tren Rata-rata Logbook / Mahasiswa" },
      tooltip: { trigger: "axis" },
      legend: { data: ["Rata-rata Logbook / Mahasiswa"], top: 0 },
      xAxis: {
        type: "category",
        name: "Minggu",
        data: weekly.map((_, i) => `W${i + 1}`),
        axisLabel: { interval: 0 },
      },
      yAxis: {
        type: "value",
        name: "Rata-rata",
      },
      series: [
        {
          name: "Rata-rata Logbook / Mahasiswa",
          data: weekly.map((s) => parseFloat(s.avg_logbooks_per_student_week.toFixed(2))),
          type: "line",
          smooth: true,
          markLine: {
            symbol: "none",
            label: {
              formatter: "Rata-rata Keseluruhan\n{c}",
              position: "insideEnd",
            },
            data: [{ yAxis: overall.avg_logbooks_per_student_week }],
            lineStyle: { type: "dashed", color: "#5470C6" },
          },
        },
      ],
    });

    this.echarts.chart2 = chart;
  }
}

LogbookProjectAnalytics.template = "jtk_logbook_analytics.LogbookProjectAnalytics";
registry.category("actions").add("jtk_logbook_analytics.logbook_project_analytics", LogbookProjectAnalytics);
