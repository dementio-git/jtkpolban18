import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import * as echarts from "echarts";

export class LogbookStudentAnalytics extends Component {
//   static props = {
//     projectId: { type: Number },
//   };

//   setup() {
//     this.state = useState({
//       viewMode: "project",
//       stats: [],
//       weeklyStats: [],
//     });
//     this.orm = useService("orm");
//     this.echarts = {}; // ✅ Tambahkan ini untuk menghindari error undefined

//     this.onChangeViewMode = (ev) => {
//       this.state.viewMode = ev.target.value;
//       setTimeout(() => {
//         if (this.state.viewMode === "project") {
//           this.renderCharts();
//         }
//       }, 0);
//     };

//     onWillStart(async () => {
//       await this.loadStats();
//       await this.loadWeeklyStats();
//     });

//     onMounted(() => {
//       setTimeout(() => {
//         if (this.state.viewMode === "project") {
//           this.renderCharts();
//         }
//       }, 0);
//     });
//   }

//   // Ambil data ringkasan keseluruhan
//   async loadStats() {
//     const domain = this.props.projectId
//       ? [["project_course_id", "=", this.props.projectId]]
//       : [];
//     this.state.stats = await this.orm.searchRead(
//       "logbook.descriptive.stats",
//       domain,
//       [
//         "project_course_id",
//         "total_students",
//         "total_logbooks",
//         "avg_logbooks_per_week",
//         "std_dev_logbooks",
//         "avg_active_students_per_week",
//         "std_dev_active_students_per_week",
//         "avg_logbooks_per_student_week",
//         "std_dev_logbooks_per_student_week",
//       ]
//     );
//   }

//   // Ambil data mingguan (untuk grafik tren)
//   async loadWeeklyStats() {
//     const domain = this.props.projectId
//       ? [["project_course_id", "=", this.props.projectId]]
//       : [];
//     this.state.weeklyStats = await this.orm.searchRead(
//       "logbook.weekly.stats",
//       domain,
//       [
//         "week_start_date",
//         "week_end_date",
//         "avg_logbooks_per_week",
//         "avg_active_students_per_week",
//         "avg_logbooks_per_student_week",
//       ]
//     );
//   }

//   renderCharts() {
//     this.renderParticipationTrendChart();
//     this.renderProductivityTrendChart();
//   }

//   formatDate(dateStr) {
//     const date = new Date(dateStr);
//     const day = String(date.getDate()).padStart(2, "0");
//     const month = String(date.getMonth() + 1).padStart(2, "0");
//     const year = date.getFullYear();
//     return `${day}/${month}/${year}`;
//   }

//   renderParticipationTrendChart() {
//     const chartDom = document.getElementById("chart1");
//     if (!chartDom) return;

//     const chart = echarts.init(chartDom);

//     const weekly = this.state.weeklyStats;
//     const overall = this.state.stats.length ? this.state.stats[0] : {};

//     const option = {
//       title: {
//         text: "Tren Waktu Logbook",
//       },
//       tooltip: {
//         trigger: "axis",
//         formatter: (params) => {
//           const index = params[0].dataIndex;
//           const stat = this.state.weeklyStats[index];
//           const start = this.formatDate(stat.week_start_date);
//           const end = this.formatDate(stat.week_end_date);
//           const items = params
//             .map((p) => `${p.marker} ${p.seriesName}: ${p.value}`)
//             .join("<br>");
//           return `Minggu ${index + 1} (${start} - ${end})<br>${items}`;
//         },
//       },
//       legend: {
//         data: [
//           "Jumlah Logbook",
//           "Mahasiswa Aktif",
//           "Rata-rata Logbook / Mahasiswa",
//         ],
//       },
//       xAxis: {
//         type: "category",
//         name: "Minggu",
//         data: weekly.map((_, index) => `W${index + 1}`),
//         axisLabel: {
//           interval: 0, // ✅ tampilkan semua label
//         },
//       },
//       yAxis: {
//         type: "value",
//         name: "Nilai",
//       },
//       series: [
//         {
//           name: "Jumlah Logbook",
//           data: weekly.map((stat) => stat.avg_logbooks_per_week),
//           type: "line",
//           smooth: true,
//           markLine: {
//             symbol: "none",
//             label: {
//               formatter: "Rata-rata Logbook/Minggu\n{c}",
//               position: "insideEnd", // atau 'insideEnd' untuk dalam area
//             },
//             data: [{ yAxis: overall.avg_logbooks_per_week }],
//             lineStyle: {
//               type: "dashed",
//               color: "#5470C6",
//             },
//           },
//         },
//         {
//           name: "Mahasiswa Aktif",
//           data: weekly.map((stat) => stat.avg_active_students_per_week),
//           type: "line",
//           smooth: true,
//           markLine: {
//             symbol: "none",
//             label: {
//               formatter: "Rata-rata Mahasiswa Aktif\n{c}",
//               position: "insideEnd",
//             },
//             data: [{ yAxis: overall.avg_active_students_per_week }],
//             lineStyle: {
//               type: "dashed",
//               color: "#91CC75",
//             },
//           },
//         },
//       ],
//     };

//     chart.setOption(option);
//     this.echarts.chart1 = chart;
//   }

//   renderProductivityTrendChart() {
//     const chartDom = document.getElementById("chart2");
//     if (!chartDom) return;

//     const chart = echarts.init(chartDom);

//     const weekly = this.state.weeklyStats;
//     const overall = this.state.stats.length ? this.state.stats[0] : {};

//     const option = {
//       title: {
//         text: "Tren Rata-rata Logbook / Mahasiswa",
//       },
//       tooltip: {
//         trigger: "axis",
//       },
//       legend: {
//         data: ["Rata-rata Logbook / Mahasiswa"],
//         top: 0,
//       },
//       xAxis: {
//         type: "category",
//         data: weekly.map((_, index) => `W${index + 1}`),
//         axisLabel: {
//           interval: 0,
//         },
//         name: "Minggu",
//       },
//       yAxis: {
//         type: "value",
//         name: "Rata-rata",
//       },
//       series: [
//         {
//           name: "Rata-rata Logbook / Mahasiswa",
//           data: weekly.map((stat) =>
//             parseFloat(stat.avg_logbooks_per_student_week.toFixed(2))
//           ),
//           type: "line",
//           smooth: true,
//           markLine: {
//             symbol: "none",
//             label: {
//               formatter: "Rata-rata Keseluruhan\n{c}",
//               position: "insideEnd",
//             },
//             data: [{ yAxis: overall.avg_logbooks_per_student_week }],
//             lineStyle: {
//               type: "dashed",
//               color: "#5470C6",
//             },
//           },
//         },
//       ],
//     };

//     chart.setOption(option);
//     this.echarts.chart2 = chart;
//   }
}

LogbookStudentAnalytics.template = "jtk_logbook_analytics.LogbookStudentAnalytics";
registry
  .category("actions")
  .add("jtk_logbook_analytics.logbook_student_analytics", LogbookStudentAnalytics);
