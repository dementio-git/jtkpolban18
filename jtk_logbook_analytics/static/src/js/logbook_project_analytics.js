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
      extractionByLabel: [],
      extractionByNormalizedLabel: [],
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
      await this.loadExtractionByLabel();
      await this.loadNormalizedByLabel(); // Panggil fungsi baru untuk memuat data normalisasi
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

  async loadExtractionByLabel() {
    this.state.extractionByLabel = await this.orm.searchRead(
      "logbook.extraction.weekly.label",
      [],
      [
        "week_start_date",
        "week_end_date",
        "week_label",
        "label_id",
        "extraction_count",
        "category_id",
        "subcategory_id",
      ]
    );
  }

  async loadNormalizedByLabel() {
    // Panggil view baru untuk mendapatkan avg_norm_point per minggu × label
    this.state.normByLabel = await this.orm.searchRead(
      "logbook.extraction.weekly.label.norm",
      [], // no domain filter
      [
        "week_label", // misal: "10 Jun 2025"
        "label_id", // [id, "Nama Label"]
        "avg_norm_point", // float (0..1)
        "category_id", // [id, "Nama Kategori"]
        "subcategory_id", // [id, "Nama Subkategori"] atau null
      ]
    );
  }

  renderCharts() {
    this.renderParticipationTrendChart();
    this.renderProductivityTrendChart();
    this.renderExtractionTrendChart(); // Tambahkan render untuk grafik ketiga
    this.renderExtractionCategoryTrendChart();
    this.renderExtractionSubcategoryTrendChart();
    this.renderExtractionLabelFreqHeatmap();
    this.renderExtractionLabelPointHeatmap();
    this.renderExtractionLabelOverallRadarChart();
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
          const weekData = data.find((d) => d.week_label === weekLabels[index]);

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

  renderExtractionLabelFreqHeatmap() {
    const chartDom = document.getElementById("heatmapLabelFreq");
    if (!chartDom) return;

    const chart = echarts.init(chartDom);
    const allData = this.state.extractionByLabel;

    if (!allData || allData.length === 0) {
      chart.clear();
      return;
    }

    // 1) Daftar week_label unik, urutkan kronologis
    const weekLabels = Array.from(
      new Set(allData.map((d) => d.week_label))
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
    const weekIndexLabels = weekLabels.map((_, i) => `W${i + 1}`);

    // 2) Daftar label unik → formatted, lalu urutkan
    const labelMap = new Map();
    allData.forEach((r) => {
      const labelName = r.label_id?.[1] || "Tanpa Label";
      const category = r.category_id?.[1] || "Tanpa Kategori";
      const subcategory = r.subcategory_id?.[1];
      const prefix = subcategory
        ? `[${category}-${subcategory}]`
        : `[${category}]`;
      labelMap.set(labelName, `${prefix} ${labelName}`);
    });
    const sortedLabelNames = Array.from(labelMap.keys()).sort((a, b) =>
      labelMap.get(a).localeCompare(labelMap.get(b))
    );
    const yLabels = sortedLabelNames.map((ln) => labelMap.get(ln));

    // 3) Bangun data heatmap sebagai [xIndex, yIndex, value]
    const heatmapData = [];
    allData.forEach((r) => {
      const wl = r.week_label;
      const labelName = r.label_id?.[1];
      const x = weekLabels.indexOf(wl);
      const y = yLabels.indexOf(labelMap.get(labelName));
      if (x !== -1 && y !== -1) {
        heatmapData.push([x, y, r.extraction_count]);
      }
    });

    // 4) Set opsi ECharts (styling sama dengan pointHeatmap, warna default = merah)
    chart.setOption({
      tooltip: {
        position: "top",
        formatter: function (params) {
          const [x, y, val] = params.data;
          return `${yLabels[y]}<br/>${weekIndexLabels[x]} (${weekLabels[x]}): ${val}`;
        },
      },
      grid: {
        top: "10%",
        left: 50,
        right: 50,
        bottom: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: weekIndexLabels,
        splitArea: { show: true },
        axisLabel: { interval: 0 },
        name: "Minggu",
      },
      yAxis: {
        type: "category",
        data: yLabels,
        splitArea: { show: true },
        name: "Label",
      },
      visualMap: {
        min: 0,
        max: Math.max(...allData.map((r) => r.extraction_count)),
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: "5%",
        textStyle: {
          fontSize: 10,
        },
        // >>> Tidak mendefinisikan inRange.color <<<
        //    ECharts akan menggunakan skema merah standar
      },
      series: [
        {
          name: "Ekstraksi",
          type: "heatmap",
          data: heatmapData,
          label: {
            show: true,
            fontSize: 10,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    });

    this.echarts.heatmapLabelFreq = chart;
  }

  renderExtractionLabelPointHeatmap() {
    const chartDom = document.getElementById("heatmapLabelPoint");
    if (!chartDom) {
      return;
    }
    const chart = echarts.init(chartDom);
    const allData = this.state.normByLabel; // pastikan sudah diisi lewat loadNormalizedByLabel()

    if (!allData || allData.length === 0) {
      chart.clear();
      return;
    }

    // 1) Daftar week_label unik (unsorted), lalu urutkan kronologis
    const weekLabels = Array.from(
      new Set(allData.map((d) => d.week_label))
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
    const weekIndexLabels = weekLabels.map((_, i) => `W${i + 1}`);

    // 2) Daftar label unik → formatted, lalu urutkan
    const labelMap = new Map();
    allData.forEach((r) => {
      const labelName = r.label_id?.[1] || "Tanpa Label";
      const category = r.category_id?.[1] || "Tanpa Kategori";
      const subcat = r.subcategory_id?.[1];
      const prefix = subcat ? `[${category}-${subcat}]` : `[${category}]`;
      labelMap.set(labelName, `${prefix} ${labelName}`);
    });
    const sortedLabelNames = Array.from(labelMap.keys()).sort((a, b) =>
      labelMap.get(a).localeCompare(labelMap.get(b))
    );
    const yLabels = sortedLabelNames.map((ln) => labelMap.get(ln));

    // 3) Bangun data heatmap sebagai [xIndex, yIndex, nilai]
    const heatmapData = [];
    allData.forEach((r) => {
      const wl = r.week_label;
      const labelName = r.label_id?.[1];
      const x = weekLabels.indexOf(wl);
      const y = yLabels.indexOf(labelMap.get(labelName));
      if (x !== -1 && y !== -1) {
        heatmapData.push([x, y, parseFloat(r.avg_norm_point)]);
      }
    });

    // 4) Set opsi ECharts
    chart.setOption({
      tooltip: {
        position: "top",
        formatter: function (params) {
          // params.data = [x, y, nilai]
          const [x, y, val] = params.data;
          return `${yLabels[y]}<br/>${weekIndexLabels[x]} (${
            weekLabels[x]
          }): ${val.toFixed(2)}`;
        },
      },
      grid: {
        top: "10%",
        left: 50,
        right: 50,
        bottom: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: weekIndexLabels,
        splitArea: { show: true },
        axisLabel: { interval: 0 },
        name: "Minggu",
      },
      yAxis: {
        type: "category",
        data: yLabels,
        splitArea: { show: true },
        name: "Label",
      },
      visualMap: {
        min: 0,
        max: 1,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: "5%",
        inRange: {
          color: ["#f7fbff", "#08306b"],
        },
      },
      series: [
        {
          name: "Point Normalisasi",
          type: "heatmap",
          data: heatmapData,
          label: {
            show: true,
            formatter: function (param) {
              return param.value[2].toFixed(2);
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    });

    this.echarts.heatmapLabelPoint = chart;
  }

  renderExtractionLabelOverallRadarChart() {
    const chartDom = document.getElementById("labelPointRadar");
    if (!chartDom) return;

    const chart = echarts.init(chartDom);
    const allData = this.state.normByLabel; // hasil loadNormalizedByLabel()

    if (!allData || allData.length === 0) {
      chart.clear();
      return;
    }

    // 1) Mapping label → nama lengkap "[Kategori] ..." (sama seperti sebelumnya)
    const labelMap = new Map();
    allData.forEach((r) => {
      const labelName = r.label_id?.[1] || "Tanpa Label";
      const category = r.category_id?.[1] || "Tanpa Kategori";
      const subcat = r.subcategory_id?.[1];
      const prefix = subcat ? `[${category}-${subcat}]` : `[${category}]`;
      labelMap.set(labelName, `${prefix} ${labelName}`);
    });

    const sortedLabelNames = Array.from(labelMap.keys()).sort((a, b) =>
      labelMap.get(a).localeCompare(labelMap.get(b))
    );
    const formattedLabels = sortedLabelNames.map((ln) => labelMap.get(ln));

    // 2) Hitung rata-rata keseluruhan untuk tiap label
    const sums = new Map(); // labelName → jumlah
    const counts = new Map(); // labelName → berapa minggu
    allData.forEach((r) => {
      const lbl = r.label_id?.[1];
      sums.set(lbl, (sums.get(lbl) || 0) + parseFloat(r.avg_norm_point));
      counts.set(lbl, (counts.get(lbl) || 0) + 1);
    });
    const overallValues = sortedLabelNames.map((lbl) => {
      const total = sums.get(lbl) || 0;
      const n = counts.get(lbl) || 1; // fallback 1 utk hindari /0
      return +(total / n).toFixed(2); // 2 desimal
    });

    // 3) Radar indikator
    const radarIndicators = formattedLabels.map((lbl) => ({
      name: lbl,
      max: 1,
    }));

    // 4) Siapkan opsi ECharts
    const option = {
      title: {
        text: "Radar: AVG Point Ternormalisasi (Overall)",
        left: "center",
      },
      tooltip: {
        trigger: "item", // tooltip aktif untuk area/garis/titik
        formatter: function (param) {
          // param.value = array nilai indikator
          let html = "<strong>Overall</strong><br/>";
          formattedLabels.forEach((lbl, i) => {
            html += `${lbl}: ${param.value[i]}<br/>`;
          });
          return html;
        },
      },
      legend: { show: false },
      radar: {
        indicator: radarIndicators,
        shape: "circle",
        splitNumber: 5,
        axisName: {
          formatter: (name) =>
            name.length > 20 ? name.slice(0, 17) + "..." : name,
        },
      },
      series: [
        {
          name: "Overall",
          type: "radar",
          // titik tetap ada agar interaksi lebih nyaman
          symbol: "circle",
          symbolSize: 6,
          // TIDAK ada pengaturan tooltip di level series/data → gunakan default
          data: [
            {
              name: "Overall",
              value: overallValues,
            },
          ],
          areaStyle: { opacity: 0.2 }, // area transparan, juga memicu tooltip
          lineStyle: { width: 2 },
          // hilangkan label "Overall" di setiap titik
          label: { show: false },
          emphasis: {
            // tetap tidak menampilkan teks di titik saat hover
            label: { show: false },
          },
        },
      ],
    };

    chart.setOption(option);
    this.echarts.radarChart = chart;
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
