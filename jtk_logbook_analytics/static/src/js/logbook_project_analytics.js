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
      extractionStats: [],
      extraction_stats: [], // Add this new state
      extractionByCategory: [],
      extractionBySubcategory: [], // <— data untuk tren subkategori
    });
    this.orm = useService("orm");
    this.echarts = {};

    onWillStart(async () => {
      await this.loadStats();
      await this.loadWeeklyStats();
      await this.loadExtractionStats();
      await this.loadExtractionDescriptiveStats();
      await this.loadExtractionByCategory();
      await this.loadExtractionBySubcategory();
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

  async loadExtractionStats() {
    this.state.extractionStats = await this.orm.searchRead(
      "logbook.extraction.weekly",
      [],
      ["week_start_date", "week_end_date", "week_label", "extraction_count"]
    );
  }

  async loadExtractionDescriptiveStats() {
    this.state.extraction_stats = await this.orm.searchRead(
      "logbook.extraction.descriptive.stats",
      [],
      [
        "avg_extraction_per_logbook",
        "std_extraction_per_logbook",
        "avg_extraction_per_student",
        "std_extraction_per_student",
        "avg_extraction_per_student_week",
        "std_extraction_per_student_week",
      ]
    );
  }

  async loadExtractionByCategory() {
    this.state.extractionByCategory = await this.orm.searchRead(
      "logbook.extraction.weekly.category",
      [],
      [
        "week_start_date",
        "week_end_date",
        "week_label",
        "category_id",
        "extraction_count",
      ]
    );
  }

  // 1) Memuat data tren subkategori
  async loadExtractionBySubcategory() {
    this.state.extractionBySubcategory = await this.orm.searchRead(
      "logbook.extraction.weekly.subcategory",
      [],
      [
        "week_start_date",
        "week_end_date",
        "week_label",
        "subcategory_id",
        "extraction_count",
      ]
    );
  }

  renderCharts() {
    this.renderParticipationTrendChart();
    this.renderProductivityTrendChart();
    this.renderExtractionTrendChart(); // Tambahkan render untuk grafik ketiga
    this.renderExtractionCategoryTrendChart();
    this.renderExtractionSubcategoryTrendChart();
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, "0")}/${(
      date.getMonth() + 1
    )
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
          return `Minggu ${index + 1} (${this.formatDate(
            s.week_start_date
          )} - ${this.formatDate(s.week_end_date)})<br>${items}`;
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
      title: { text: "Tren Produktivitas Logbook per Mahasiswa" },
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
          data: weekly.map((s) =>
            parseFloat(s.avg_logbooks_per_student_week.toFixed(2))
          ),
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

  renderExtractionTrendChart() {
    const chartDom = document.getElementById("chart3");
    if (!chartDom) return;

    const chart = echarts.init(chartDom);
    const extr = this.state.extractionStats;

    if (!extr || extr.length === 0) {
      chart.clear();
      return;
    }

    chart.setOption({
      title: { text: "Tren Jumlah Ekstraksi Label per Minggu" },
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          const index = params[0].dataIndex;
          const s = this.state.extractionStats[index];
          return `Minggu ${index + 1} (${this.formatDate(
            s.week_start_date
          )} - ${this.formatDate(s.week_end_date)})<br>
            Jumlah Ekstraksi: ${params[0].value}`;
        },
      },
      legend: {
        data: ["Rata-rata Logbook / Mahasiswa"],
        top: 0,
        type: "scroll",
        formatter: (name) => {
          const values = extr.map((s) => s.extraction_count);
          values.sort((a, b) => b - a);
          return name + ": " + values[0];
        },
      },
      xAxis: {
        type: "category",
        name: "Minggu",
        data: extr.map((_, i) => `W${i + 1}`),
        axisLabel: { interval: 0 },
      },
      yAxis: {
        type: "value",
        name: "Total Ekstraksi",
      },
      series: [
        {
          name: "Jumlah Ekstraksi",
          data: extr.map((s) => s.extraction_count),
          type: "line",
          smooth: true,
          markLine: {
            symbol: "none",
            label: {
              formatter: "Total Ekstraksi Rata-rata\n{c}",
              position: "insideEnd",
            },
            data: [
              {
                yAxis: (() => {
                  const sum = extr.reduce(
                    (acc, cur) => acc + (cur.extraction_count || 0),
                    0
                  );
                  return extr.length ? (sum / extr.length).toFixed(2) : 0;
                })(),
              },
            ],
            lineStyle: { type: "dashed", color: "#EE6666" },
          },
        },
      ],
    });

    this.echarts.chart3 = chart;
  }

  renderExtractionCategoryTrendChart() {
    const chartDom = document.getElementById("chart4");
    if (!chartDom) return;

    const chart = echarts.init(chartDom);
    const data = this.state.extractionByCategory; // [{week_start_date,week_label,category_id,extraction_count}, ...]
    const weekly = this.state.extractionStats; // Untuk label minggu

    if (!data || data.length === 0) {
      chart.clear();
      return;
    }

    // 1. Kumpulkan semua label kategori unik
    const categories = Array.from(new Set(data.map((r) => r.category_id[1])));
    // 2. Kumpulkan semua minggu unik, urutkan berdasarkan tanggal
    const weekLabels = Array.from(new Set(data.map((r) => r.week_label))).sort(
      (a, b) => {
        // Parse format "DD Mon YYYY"
        const parse = (s) => {
          const parts = s.split(" ");
          const day = parseInt(parts[0], 10);
          const monthNames = {
            Jan: 0,
            Feb: 1,
            Mar: 2,
            Apr: 3,
            May: 4,
            Jun: 5,
            Jul: 6,
            Aug: 7,
            Sep: 8,
            Oct: 9,
            Nov: 10,
            Dec: 11,
          };
          const month = monthNames[parts[1]];
          const year = parseInt(parts[2], 10);
          return new Date(year, month, day);
        };
        return parse(a) - parse(b);
      }
    );

    // 3. Bangun series: satu objek per kategori
    const seriesData = categories.map((cat) => {
      return {
        name: cat,
        type: "line",
        smooth: true,
        data: weekLabels.map((wl) => {
          const rec = data.find(
            (r) => r.week_label === wl && r.category_id[1] === cat
          );
          return rec ? rec.extraction_count : 0;
        }),
      };
    });

    // 4. Set option ECharts
    chart.setOption({
      title: { text: "Tren Ekstraksi per Minggu per Kategori Label" },
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          // Sort params by value in descending order
          params.sort((a, b) => b.value - a.value);

          // Get the week data
          const index = params[0].dataIndex;
          const weekData = data.find(
            (d) => d.week_label === weekLabels[index]
          );

          // Build tooltip header with date range
          let result = `Minggu ${index + 1} (${this.formatDate(
            weekData.week_start_date
          )} - ${this.formatDate(weekData.week_end_date)})<br/>`;

          // Add each series sorted by value
          params.forEach((param) => {
            if (param.value > 0) {
              // Only show non-zero values
              result += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
            }
          });

          return result;
        },
      },
      legend: { data: categories, top: 0 },
      xAxis: {
        type: "category",
        name: "Minggu",
        data: weekly.map((_, i) => `W${i + 1}`),
        axisLabel: { interval: 0 },
      },
      yAxis: {
        type: "value",
        name: "Jumlah Ekstraksi",
      },
      series: seriesData,
    });

    this.echarts.chart4 = chart;
  }

  // === Grafik Tren Ekstraksi per Subkategori ===
  renderExtractionSubcategoryTrendChart() {
    const chartDom = document.getElementById("chart5");
    if (!chartDom) return;

    const chart = echarts.init(chartDom);
    const allData = this.state.extractionBySubcategory;

    const weekly = this.state.extractionStats;

    if (!allData || allData.length === 0) {
      chart.clear();
      return;
    }

    // Get all unique subcategory names directly
    const subNames = Array.from(
      new Set(allData.map((r) => r.subcategory_id[1]))
    );

    // Get unique week labels and sort them
    const weekLabels = Array.from(
      new Set(allData.map((r) => r.week_label))
    ).sort((a, b) => {
      const parse = (s) => {
        const [day, mon, year] = s.split(" ");
        const monthMap = {
          Jan: 0,
          Feb: 1,
          Mar: 2,
          Apr: 3,
          May: 4,
          Jun: 5,
          Jul: 6,
          Aug: 7,
          Sep: 8,
          Oct: 9,
          Nov: 10,
          Dec: 11,
        };
        return new Date(parseInt(year), monthMap[mon], parseInt(day));
      };
      return parse(a) - parse(b);
    });

    // Create series for each subcategory
    const seriesData = subNames.map((subName) => ({
      name: subName,
      type: "line",
      smooth: true,
      data: weekLabels.map((wl) => {
        const rec = allData.find(
          (r) => r.week_label === wl && r.subcategory_id[1] === subName
        );
        return rec ? rec.extraction_count : 0;
      }),
    }));

    chart.setOption({
      title: {
        text: "Tren Ekstraksi per Subkategori",
      },
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          // Sort params by value in descending order
          params.sort((a, b) => b.value - a.value);

          // Get the week data
          const index = params[0].dataIndex;
          const weekData = allData.find(
            (d) => d.week_label === weekLabels[index]
          );

          // Build tooltip header with date range
          let result = `Minggu ${index + 1} (${this.formatDate(
            weekData.week_start_date
          )} - ${this.formatDate(weekData.week_end_date)})<br/>`;

          // Add each series sorted by value
          params.forEach((param) => {
            if (param.value > 0) {
              // Only show non-zero values
              result += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
            }
          });

          return result;
        },
      },
      legend: {
        data: subNames,
        top: 0,
        type: "scroll",
      },
      xAxis: {
        type: "category",
        name: "Minggu",
        data: weekly.map((_, i) => `W${i + 1}`),
        axisLabel: { interval: 0 },
      },
      yAxis: {
        type: "value",
        name: "Jumlah Ekstraksi",
      },
      series: seriesData,
    });

    this.echarts.chart5 = chart;
  }
}

LogbookProjectAnalytics.template =
  "jtk_logbook_analytics.LogbookProjectAnalytics";
registry
  .category("actions")
  .add(
    "jtk_logbook_analytics.logbook_project_analytics",
    LogbookProjectAnalytics
  );
