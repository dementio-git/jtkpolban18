/** @odoo-module **/

import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
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

export class LogbookProjectAnalytics extends Component {
  setup() {
    this.state = useState({
      stats: [],
      weeklyStats: [],
      projectCourseId: null,
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
      let pid = this.props.action?.context?.default_project_course_id;
      if (!pid) {
        pid = getRecordIdFromPath();
      }
      this.state.projectCourseId = pid;

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
    const pid = this.state.projectCourseId;
    if (!pid) {
      console.warn("projectCourseId belum tersedia");
      this.state.stats = [];
      return;
    }
    this.state.stats = await this.orm.searchRead(
      "logbook.descriptive.stats",
      [["project_course_id", "=", pid]],
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
    const pid = this.state.projectCourseId;
    if (!pid) {
      console.warn("projectCourseId belum tersedia");
      this.state.weeklyStats = [];
      return;
    }
    this.state.weeklyStats = await this.orm.searchRead(
      "logbook.weekly.stats",
      [["project_course_id", "=", pid]],
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
    const pid = this.state.projectCourseId;
    if (!pid) {
      this.state.extractionStats = [];
      return;
    }
    this.state.extractionStats = await this.orm.searchRead(
      "logbook.extraction.weekly",
      [["project_course_id", "=", pid]],
      ["week_start_date", "week_end_date", "week_label", "extraction_count"]
    );
  }

  async loadExtractionDescriptiveStats() {
    const pid = this.state.projectCourseId;
    if (!pid) {
      this.state.extraction_stats = [];
      return;
    }
    this.state.extraction_stats = await this.orm.searchRead(
      "logbook.extraction.descriptive.stats",
      [["project_course_id", "=", pid]],
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
    const pid = this.state.projectCourseId;
    if (!pid) {
      this.state.extractionByCategory = [];
      return;
    }
    this.state.extractionByCategory = await this.orm.searchRead(
      "logbook.extraction.weekly.category",
      [["project_course_id", "=", pid]],
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
    const pid = this.state.projectCourseId;
    if (!pid) {
      this.state.extractionBySubcategory = [];
      return;
    }
    this.state.extractionBySubcategory = await this.orm.searchRead(
      "logbook.extraction.weekly.subcategory",
      [["project_course_id", "=", pid]],
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
    const pid = this.state.projectCourseId;
    if (!pid) {
      this.state.extractionByLabel = [];
      return;
    }
    this.state.extractionByLabel = await this.orm.searchRead(
      "logbook.extraction.weekly.label",
      [["project_course_id", "=", pid]],
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
    const pid = this.state.projectCourseId;
    if (!pid) {
      this.state.normByLabel = [];
      return;
    }
    // Panggil view baru untuk mendapatkan avg_norm_point per minggu × label
    this.state.normByLabel = await this.orm.searchRead(
      "logbook.extraction.weekly.label.norm",
      [["project_course_id", "=", pid]], // no domain filter
      [
        "week_label",
        "label_id", 
        "avg_norm_point", 
        "category_id", 
        "subcategory_id", 
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

    //
    // 1) Kumpulkan pasangan [category_id, category_name] unik
    //
    //    Kita pakai Map agar kunci = category_id (angka), nilai = category_name.
    const mapCat = new Map();
    data.forEach((r) => {
      const [catId, catName] = r.category_id; // misal [3, "Motivasi"]
      mapCat.set(catId, catName);
    });
    // Sekarang convert Map ke array [[id, name], ...] lalu urutkan berdasarkan id
    const categoryPairs = Array.from(mapCat.entries()).sort(
      (a, b) => a[0] - b[0]
    );
    // Pisahkan kembali menjadi dua array: ids dan names dalam urutan yg sudah di-sort
    const categoryIds = categoryPairs.map((pair) => pair[0]); // [2, 5, 7, ...]
    const categories = categoryPairs.map((pair) => pair[1]); // ["Konten", "Motivasi", "Waktu", ...]

    //
    // 2) Kumpulkan semua minggu unik, urutkan berdasarkan tanggal
    //
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
    // Label sumbu X: W1, W2, W3, ...
    const weekIndexLabels = weekLabels.map((_, i) => `W${i + 1}`);

    //
    // 3) Bangun seriesData: satu objek per kategori (dalam urutan ascending ID)
    //
    const seriesData = categoryIds.map((catId, idx) => {
      const catName = categories[idx];
      return {
        name: catName,
        type: "line",
        smooth: true,
        data: weekLabels.map((wl) => {
          // Cari record yang sama minggu + category_id
          const rec = data.find(
            (r) => r.week_label === wl && r.category_id[0] === catId
          );
          return rec ? rec.extraction_count : 0;
        }),
      };
    });

    //
    // 4) Set opsi ECharts
    //
    chart.setOption({
      title: { text: "Tren Ekstraksi per Minggu per Kategori Label" },
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          // Urutkan params berdasarkan nilai descending, agar tooltip tampilkan besar ke kecil
          params.sort((a, b) => b.value - a.value);

          // Cari data minggu berdasarkan dataIndex (indeks minggu ke berapa)
          const index = params[0].dataIndex;
          const weekData = data.find((d) => d.week_label === weekLabels[index]);

          // Bangun header tooltip: "Minggu X (tanggal ... - tanggal ...)"
          let result = `Minggu ${index + 1} (${this.formatDate(
            weekData.week_start_date
          )} - ${this.formatDate(weekData.week_end_date)})<br/>`;

          // Tambahkan setiap seri (kategori) dengan nilai > 0
          params.forEach((param) => {
            if (param.value > 0) {
              result += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
            }
          });
          return result;
        },
      },
      legend: {
        data: categories, // urutan nama kategori sudah berdasarkan ascending ID
        top: 0,
        type: "scroll",
      },
      xAxis: {
        type: "category",
        name: "Minggu",
        data: weekIndexLabels,
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

    //
    // 1) Kumpulkan pasangan [subcategory_id, subcategory_name] unik
    //
    const mapSub = new Map();
    allData.forEach((r) => {
      const [subId, subName] = r.subcategory_id; // misal [12, "Detail"]
      mapSub.set(subId, subName);
    });
    // Ubah map ke array [[id, name], ...] lalu urutkan berdasarkan id ascending
    const subPairs = Array.from(mapSub.entries()).sort((a, b) => a[0] - b[0]);
    const subIds = subPairs.map((p) => p[0]); // [id1, id2, ...]
    const subNames = subPairs.map((p) => p[1]); // ["SubA", "SubB", ...]

    //
    // 2) Ambil semua week_label unik, urutkan kronologis
    //
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
    const weekIndexLabels = weekLabels.map((_, i) => `W${i + 1}`);

    //
    // 3) Bangun series: satu objek per subkategori (urut by subIds)
    //
    const seriesData = subIds.map((subId, idx) => {
      const subName = subNames[idx];
      return {
        name: subName,
        type: "line",
        smooth: true,
        data: weekLabels.map((wl) => {
          const rec = allData.find(
            (r) => r.week_label === wl && r.subcategory_id[0] === subId
          );
          return rec ? rec.extraction_count : 0;
        }),
      };
    });

    //
    // 4) Set opsi ECharts
    //
    chart.setOption({
      title: {
        text: "Tren Ekstraksi per Subkategori",
      },
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          // Urutkan params berdasarkan value descending
          params.sort((a, b) => b.value - a.value);
          const index = params[0].dataIndex;
          const weekData = allData.find(
            (d) => d.week_label === weekLabels[index]
          );
          let result = `Minggu ${index + 1} (${this.formatDate(
            weekData.week_start_date
          )} - ${this.formatDate(weekData.week_end_date)})<br/>`;
          params.forEach((param) => {
            if (param.value > 0) {
              result += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
            }
          });
          return result;
        },
      },
      legend: {
        data: subNames, // sudah urut by subIds ascending
        top: 0,
        type: "scroll",
      },
      xAxis: {
        type: "category",
        name: "Minggu",
        data: weekIndexLabels,
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

    // 1) Ambil daftar week_label unik dan urutkan kronologis
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

    // 2) Kumpulkan objek label unik dengan informasi ID, category ID, subcategory ID, dan formatted name
    const labelInfoMap = new Map();
    allData.forEach((r) => {
      const [labelId, labelName] = r.label_id;
      const [categoryId, categoryName] = r.category_id;
      const subcategoryName = r.subcategory_id?.[1] || "";
      const prefix = subcategoryName
        ? `[${categoryName}-${subcategoryName}]`
        : `[${categoryName}]`;
      const formatted = `${prefix} ${labelName}`;

      if (!labelInfoMap.has(labelId)) {
        labelInfoMap.set(labelId, {
          labelId,
          labelName,
          categoryId,
          formatted,
        });
      }
    });

    // 3) Konversi Map ke array, lalu sort berdasarkan categoryId ascending, lalu labelId ascending
    const labelInfos = Array.from(labelInfoMap.values()).sort((a, b) => {
      if (a.categoryId !== b.categoryId) {
        return b.categoryId - a.categoryId;
      }
      return b.labelId - a.labelId;
    });

    // 4) Buat array yLabels (formatted) dan peta labelId → index
    const yLabels = labelInfos.map((info) => info.formatted);
    const labelIndexMap = new Map(
      labelInfos.map((info, idx) => [info.labelId, idx])
    );

    // 5) Bangun data heatmap sebagai [xIndex, yIndex, value]
    const heatmapData = [];
    allData.forEach((r) => {
      const wl = r.week_label;
      const [labId] = r.label_id;
      const x = weekLabels.indexOf(wl);
      const y = labelIndexMap.get(labId);
      if (x !== -1 && y !== undefined) {
        heatmapData.push([x, y, r.extraction_count]);
      }
    });

    // 6) Set opsi ECharts
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
        // Menggunakan skema merah standar
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

    // 1) Ambil daftar week_label unik, urutkan kronologis
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

    // 2) Kumpulkan objek label unik dengan ID, category ID, dan formatted name
    const labelInfoMap = new Map();
    allData.forEach((r) => {
      const [labelId, labelName] = r.label_id;
      const [categoryId, categoryName] = r.category_id;
      const subcategoryName = r.subcategory_id?.[1] || "";
      const prefix = subcategoryName
        ? `[${categoryName}-${subcategoryName}]`
        : `[${categoryName}]`;
      const formatted = `${prefix} ${labelName}`;

      if (!labelInfoMap.has(labelId)) {
        labelInfoMap.set(labelId, {
          labelId,
          categoryId,
          formatted,
        });
      }
    });

    // 3) Convert Map ke array, lalu sort descending berdasarkan categoryId lalu labelId
    const labelInfos = Array.from(labelInfoMap.values()).sort((a, b) => {
      if (a.categoryId !== b.categoryId) {
        return b.categoryId - a.categoryId; // descending category ID
      }
      return b.labelId - a.labelId; // descending label ID
    });

    // 4) Buat yLabels dan labelIndexMap
    const yLabels = labelInfos.map((info) => info.formatted);
    const labelIndexMap = new Map(
      labelInfos.map((info, idx) => [info.labelId, idx])
    );

    // 5) Bangun data heatmap sebagai [xIndex, yIndex, nilai]
    const heatmapData = [];
    allData.forEach((r) => {
      const wl = r.week_label;
      const [labId] = r.label_id;
      const x = weekLabels.indexOf(wl);
      const y = labelIndexMap.get(labId);
      if (x !== -1 && y !== undefined) {
        heatmapData.push([x, y, parseFloat(r.avg_norm_point)]);
      }
    });

    // 6) Set opsi ECharts
    chart.setOption({
      tooltip: {
        position: "top",
        formatter: function (params) {
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

    // 1) Kumpulkan info unik tiap label: [labelId, categoryId, avg values…]
    const labelInfoMap = new Map();
    allData.forEach((r) => {
      const [labelId, labelName] = r.label_id;
      const [categoryId] = r.category_id;
      const [subcatId, subcatName] = r.subcategory_id || [null, ""];
      const categoryName = r.category_id?.[1] || "Tanpa Kategori";
      const prefix = subcatName
        ? `[${categoryName}-${subcatName}]`
        : `[${categoryName}]`;
      const formatted = `${prefix} ${labelName}`;

      if (!labelInfoMap.has(labelId)) {
        labelInfoMap.set(labelId, {
          labelId,
          categoryId,
          formatted,
          sum: 0,
          count: 0,
        });
      }
      const info = labelInfoMap.get(labelId);
      const val = parseFloat(r.avg_norm_point);
      info.sum += val;
      info.count += 1;
    });

    // 2) Convert Map ke array lalu sort DESC categoryId, kemudian DESC labelId
    const labelInfos = Array.from(labelInfoMap.values()).sort((a, b) => {
      if (a.categoryId !== b.categoryId) {
        return b.categoryId - a.categoryId; // descending category ID
      }
      return b.labelId - a.labelId; // descending label ID
    });

    // 3) Bangun arrays formattedLabels & overallValues sesuai urutan itu
    const formattedLabels = labelInfos.map((info) => info.formatted);
    const overallValues = labelInfos.map(
      (info) => +(info.sum / (info.count || 1)).toFixed(2)
    );

    // 4) Radar indikator
    const radarIndicators = formattedLabels.map((lbl) => ({
      name: lbl,
      max: 1,
    }));

    // 5) Siapkan opsi ECharts
    const option = {
      title: {
        text: "Radar: AVG Point Ternormalisasi (Overall)",
        left: "center",
      },
      tooltip: {
        trigger: "item",
        textStyle: {
          fontSize: 10, // Mengecilkan font tooltip
        },
        formatter: function (param) {
          // param.value = array nilai indikator
          const values = param.value; // array, misal [0.63, 0.55, ...]
          // Buat array pasangan { label, val }
          const list = formattedLabels.map((lbl, i) => ({
            label: lbl,
            val: values[i],
          }));
          // Urutkan descending berdasarkan val
          list.sort((a, b) => b.val - a.val);
          // Bangun HTML
          let html = "<strong>Overall</strong><br/>";
          list.forEach((item) => {
            html += `${item.label}: ${item.val}<br/>`;
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
          symbol: "circle",
          symbolSize: 6,
          data: [
            {
              name: "Overall",
              value: overallValues,
            },
          ],
          areaStyle: { opacity: 0.2 },
          lineStyle: { width: 2 },
          label: { show: false },
          emphasis: {
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
