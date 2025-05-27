/** @odoo-module **/

import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import * as echarts from "echarts";

export class LogbookClassAnalytics extends Component {
  setup() {
    this.state = useState({ weeklyStats: [] });
    this.orm = useService("orm");
    this.echarts = {};

    onWillStart(async () => {
      await this.loadWeeklyStats();
    });

    onMounted(() => {
      this.renderCharts();
    });
  }

  async loadWeeklyStats() {
    this.state.weeklyStats = await this.orm.searchRead(
      "logbook.weekly.stats.class",
      [],
      [
        "class_id",
        "class_name",
        "week_start_date",
        "week_end_date",
        "avg_logbooks_per_week",
        "avg_active_students_per_week",
        "avg_logbooks_per_student_week",
      ]
    );
  }

  renderCharts() {
    this.renderClassParticipationChart();
    this.renderClassProductivityChart();
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
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
    const chart = echarts.init(chartDom);

    const grouped = this.groupByClass();
    const weekLabels = [...new Set(this.state.weeklyStats.map((_, i) => `W${i + 1}`))];

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
    this.echarts.chart1 = chart;
  }

  renderClassProductivityChart() {
    const chartDom = document.getElementById("chart2");
    if (!chartDom) return;
    const chart = echarts.init(chartDom);

    const grouped = this.groupByClass();
    const weekLabels = [...new Set(this.state.weeklyStats.map((_, i) => `W${i + 1}`))];

    const series = Object.entries(grouped).map(([className, stats]) => ({
      name: `Produktif - ${className}`,
      data: stats.map((s) => parseFloat(s.avg_logbooks_per_student_week.toFixed(2))),
      type: "line",
      smooth: true,
    }));

    chart.setOption({
      title: { text: "Tren Produktivitas Logbook per Mahasiswa per Kelas" },
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
      series,
    });
    this.echarts.chart2 = chart;
  }
}

LogbookClassAnalytics.template = "jtk_logbook_analytics.LogbookClassAnalytics";
registry.category("actions").add("jtk_logbook_analytics.logbook_class_analytics", LogbookClassAnalytics);
