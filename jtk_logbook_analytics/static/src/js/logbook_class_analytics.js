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
      extractionWeeklyByClass: [],
      extractionDescriptiveByClass: [],
      extractionByCategory: [],
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
      await this.loadExtractionStatsByClass();
      await this.loadExtractionDescriptiveStatsByClass();
      await this.loadExtractionByCategory();
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

  async loadExtractionStatsByClass() {
    const pid = this.state.projectCourseId;
    if (!pid) {
      this.state.extractionWeeklyByClass = [];
      return;
    }
    this.state.extractionWeeklyByClass = await this.orm.searchRead(
      "logbook.extraction.weekly.class",
      [["project_course_id", "=", pid]],
      [
        "project_course_id",
        "class_id",
        "class_name",
        "week_label",
        "week_start_date",
        "week_end_date",
        "extraction_count",
      ]
    );
  }

  async loadExtractionDescriptiveStatsByClass() {
    const pid = this.state.projectCourseId || false;
    const domain = pid ? [["project_course_id", "=", pid]] : [];
    this.state.extractionDescriptiveByClass = await this.orm.searchRead(
      "logbook.extraction.descriptive.stats.class",
      domain,
      [
        "class_id",
        "class_name",
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
      "logbook.extraction.weekly.category.class",
      [["project_course_id", "=", pid]],
      [
        "class_id",
        "class_name",
        "week_start_date",
        "week_end_date",
        "week_label",
        "category_id",
        "extraction_count",
      ]
    );
  }

  renderCharts() {
    this.renderClassParticipationChart();
    this.renderClassProductivityChart();
    this.renderExtractionTrendChartByClass();
    this.renderExtractionStackedBarByCategoryAndClass();
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
        top: 10,
      },
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

  renderExtractionTrendChartByClass() {
    const chartDom = document.getElementById("chart3");
    if (!chartDom) return;

    if (this.echarts.chart3) {
      this.echarts.chart3.dispose();
    }
    const chart = echarts.init(chartDom);

    // Ambil data hasil searchRead dari model logbook.extraction.weekly.class
    const extr = this.state.extractionWeeklyByClass;

    if (!extr || extr.length === 0) {
      chart.clear();
      return;
    }

    // 1) Dapatkan semua week_start_date unik, lalu sortir kronologis
    const uniqueWeeks = Array.from(
      new Set(extr.map((r) => r.week_start_date))
    ).sort((a, b) => new Date(a) - new Date(b));

    // 2) Buat label W1, W2, … sesuai urutan uniqueWeeks
    const weekLabels = uniqueWeeks.map((_, idx) => `W${idx + 1}`);

    // 3) Kumpulkan nama‐nama kelas unik
    const classNames = Array.from(new Set(extr.map((r) => r.class_name)));

    // 4) Buat struktur data kosong per kelas, indexed by week_start_date
    const dataByClass = {};
    classNames.forEach((cn) => {
      dataByClass[cn] = {};
    });

    // 5) Isi dataByClass[class_name][week_start_date] = extraction_count
    extr.forEach((rec) => {
      const cn = rec.class_name;
      const wk = rec.week_start_date;
      dataByClass[cn][wk] = rec.extraction_count || 0;
    });

    // 6) Bangun array series untuk tiap kelas
    const series = classNames.map((cn) => {
      const values = uniqueWeeks.map((wk) =>
        wk in dataByClass[cn] ? dataByClass[cn][wk] : 0
      );
      return {
        name: cn,
        type: "line",
        smooth: true,
        data: values,
      };
    });

    // 7) Hitung rata-rata (garis putus-putus)
    const semuaValues = [];
    classNames.forEach((cn) => {
      uniqueWeeks.forEach((wk) => {
        semuaValues.push(dataByClass[cn][wk] || 0);
      });
    });
    const sumAll = semuaValues.reduce((acc, v) => acc + v, 0);
    const avgAll =
      semuaValues.length > 0 ? (sumAll / semuaValues.length).toFixed(2) : 0;

    series.push({
      name: "Rata-rata Semua",
      type: "line",
      data: [],
      markLine: {
        symbol: "none",
        label: {
          formatter: `Rata-rata\n${avgAll}`,
          position: "insideEnd",
        },
        data: [{ yAxis: parseFloat(avgAll) }],
        lineStyle: { type: "dashed", color: "#EE6666" },
      },
    });

    // 8) Susun option dan render
    const option = {
      title: { text: "Tren Jumlah Ekstraksi per Minggu (Class)" },
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          const idx = params[0].dataIndex;
          // Cari salah satu record untuk mendapatkan week_end_date
          const contohRec = extr.find(
            (r) => r.week_start_date === uniqueWeeks[idx]
          );
          let header = `Minggu ${idx + 1} (${this.formatDate(
            contohRec.week_start_date
          )} - ${this.formatDate(contohRec.week_end_date)})<br/>`;
          params.forEach((p) => {
            if (p.data > 0) {
              header += `${p.marker} ${p.seriesName}: ${p.data}<br/>`;
            }
          });
          return header;
        },
      },
      legend: {
        data: classNames,
        top: 30,
        type: "scroll",
      },
      xAxis: {
        type: "category",
        name: "Minggu",
        data: weekLabels,
        axisLabel: { interval: 0 },
      },
      yAxis: {
        type: "value",
        name: "Total Ekstraksi",
      },
      series: series,
    };

    chart.setOption(option);
    this.echarts.chart3 = chart;
  }

  // renderExtractionStackedBarByCategoryAndClass() {
  //   const chartDom = document.getElementById("chart4");
  //   if (!chartDom) return;
  //   if (this.echarts.chart4) this.echarts.chart4.dispose();
  //   const chart = echarts.init(chartDom);
  //   const data = this.state.extractionByCategory;
  //   if (!data || !data.length) {
  //     chart.clear();
  //     return;
  //   }

  //   // 1) Urutkan minggu berdasarkan tanggal
  //   const parseDate = (s) => {
  //     const [d, mon, y] = s.split(" ");
  //     const m = {
  //       Jan: 0,
  //       Feb: 1,
  //       Mar: 2,
  //       Apr: 3,
  //       May: 4,
  //       Jun: 5,
  //       Jul: 6,
  //       Aug: 7,
  //       Sep: 8,
  //       Oct: 9,
  //       Nov: 10,
  //       Dec: 11,
  //     }[mon];
  //     return new Date(+y, m, +d);
  //   };
  //   const weeks = Array.from(new Set(data.map((r) => r.week_label))).sort(
  //     (a, b) => parseDate(a) - parseDate(b)
  //   );
  //   const xWeeks = weeks.map((_, i) => `W${i + 1}`);

  //   // 2) Urutkan kategori global berdasarkan category_id
  //   const catMap = new Map();
  //   data.forEach((r) => {
  //     const [catId, catName] = r.category_id;
  //     catMap.set(catId, catName);
  //   });
  //   const categories = Array.from(catMap.entries())
  //     .sort((a, b) => a[0] - b[0])
  //     .map(([, name]) => name);

  //   // 3) Kelas
  //   const classes = Array.from(new Set(data.map((r) => r.class_name))).sort();

  //   // 4) Pivot data: pivot[week][category][class] = count
  //   const pivot = {};
  //   weeks.forEach((wk) => {
  //     pivot[wk] = {};
  //     categories.forEach((cat) => {
  //       pivot[wk][cat] = {};
  //       classes.forEach((cls) => {
  //         pivot[wk][cat][cls] = 0;
  //       });
  //     });
  //   });
  //   data.forEach((r) => {
  //     const wk = r.week_label;
  //     const cat = r.category_id[1];
  //     const cls = r.class_name;
  //     pivot[wk][cat][cls] = r.extraction_count;
  //   });

  //   // 5) Buat satu options per minggu
  //   const options = weeks.map((wk, idx) => {
  //     const series = classes.map((cls) => ({
  //       name: cls,
  //       type: "bar",
  //       stack: "total",
  //       data: categories.map((cat) => pivot[wk][cat][cls]),
  //     }));
  //     return {
  //       title: { text: `Ekstraksi — Minggu ${wk}` },
  //       tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  //       legend: { data: classes, top: 30, type: "scroll" },
  //       xAxis: { type: "category", data: categories, name: "Kategori" },
  //       yAxis: { type: "value", name: "Jumlah Ekstraksi" },
  //       series,
  //     };
  //   });

  //   // 6) Mode “All” dengan axis dua level: minggu → kategori
  //   // 6a) Siapkan xAxis.data sebagai array dua dimensi [week, category]
  //   const xAxisData = [];
  //   weeks.forEach((wk, wi) => {
  //     categories.forEach((cat) => {
  //       xAxisData.push([`W${wi + 1}`, cat]);
  //     });
  //   });

  //   // 6b) Series: satu per kelas, stack: 'total'
  //   const allSeries = classes.map((cls) => ({
  //     name: cls,
  //     type: "bar",
  //     stack: "total",
  //     // data harus sebaris dengan xAxisData
  //     data: weeks.flatMap((wk) => categories.map((cat) => pivot[wk][cat][cls])),
  //   }));

  //   options.push({
  //     title: { text: "Ekstraksi — Semua Minggu" },
  //     tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  //     legend: { data: classes, top: 30, type: "scroll" },
  //     xAxis: {
  //       type: "category",
  //       data: xAxisData,
  //       name: "Minggu / Kategori",
  //       axisLabel: {
  //         // tampilkan hanya baris kategori di label
  //         formatter: (val) => (Array.isArray(val) ? val[1] : val),
  //         interval: 0,
  //         rotate: 45,
  //         fontsize: 9
  //       },
  //       // untuk menampilkan label multi-line
  //       axisTick: { alignWithLabel: true },
  //     },
  //     yAxis: { type: "value", name: "Jumlah Ekstraksi" },
  //     series: allSeries,
  //   });

  //   // 7) Pasang baseOption + timeline
  //   chart.setOption({
  //     baseOption: {
  //       timeline: {
  //         axisType: "category",
  //         data: [...xWeeks, "All"],
  //         autoPlay: false,
  //         label: {
  //           formatter: (s) => (s === "All" ? "All" : s),
  //         },
  //       },
  //       tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  //       legend: { top: 30, type: "scroll" },
  //       grid: { top: 80, left: 50, right: 30, bottom: 50 },
  //     },
  //     options,
  //   });

  //   this.echarts.chart4 = chart;
  // }

  // renderExtractionStackedBarByCategoryAndClass() {
  //   const chartDom = document.getElementById("chart4");
  //   if (!chartDom) return;
  //   if (this.echarts.chart4) this.echarts.chart4.dispose();
  //   const chart = echarts.init(chartDom);
  //   const data = this.state.extractionByCategory;
  //   if (!data || !data.length) {
  //     chart.clear();
  //     return;
  //   }

  //   // parse dan urutkan minggu
  //   const parseDate = (s) => {
  //     const [d, mon, y] = s.split(" ");
  //     const m = {
  //       Jan: 0,
  //       Feb: 1,
  //       Mar: 2,
  //       Apr: 3,
  //       May: 4,
  //       Jun: 5,
  //       Jul: 6,
  //       Aug: 7,
  //       Sep: 8,
  //       Oct: 9,
  //       Nov: 10,
  //       Dec: 11,
  //     }[mon];
  //     return new Date(+y, m, +d);
  //   };
  //   const weeks = Array.from(new Set(data.map((r) => r.week_label))).sort(
  //     (a, b) => parseDate(a) - parseDate(b)
  //   );
  //   const xWeeks = weeks.map((w, i) => `W${i + 1}`);

  //   // urutkan kategori & kelas
  //   const catMap = new Map();
  //   data.forEach((r) => catMap.set(r.category_id[1], true));
  //   const categories = Array.from(catMap.keys());
  //   const classes = Array.from(new Set(data.map((r) => r.class_name)));

  //   // pivot[wk][cat][cls] = count
  //   const pivot = {};
  //   weeks.forEach((wk) => {
  //     pivot[wk] = {};
  //     categories.forEach((cat) => {
  //       pivot[wk][cat] = {};
  //       classes.forEach((cls) => {
  //         pivot[wk][cat][cls] = 0;
  //       });
  //     });
  //   });
  //   data.forEach((r) => {
  //     pivot[r.week_label][r.category_id[1]][r.class_name] = r.extraction_count;
  //   });

  //   // series: untuk setiap kategori, dalamnya satu series per kelas, dengan stack = nama kategori
  //   const series = [];
  //   categories.forEach((cat) => {
  //     classes.forEach((cls) => {
  //       series.push({
  //         name: cls,
  //         type: "bar",
  //         stack: cat, // semua series dalam satu kategori di-stack
  //         data: weeks.map((wk) => pivot[wk][cat][cls]),
  //         barCategoryGap: "20%", // spasi antara stack groups
  //       });
  //     });
  //   });

  //   chart.setOption({
  //     title: { text: "Ekstraksi — Semua Minggu" },
  //     tooltip: {
  //       trigger: "axis",
  //       axisPointer: { type: "shadow" },
  //     },
  //     legend: {
  //       data: classes,
  //       top: 30,
  //       type: "scroll",
  //     },
  //     xAxis: {
  //       type: "category",
  //       data: xWeeks,
  //       name: "Minggu",
  //       axisLabel: {
  //         interval: 0,
  //         rotate: 45,
  //         fontSize: 10,
  //         margin: 8,
  //       },
  //     },
  //     yAxis: {
  //       type: "value",
  //       name: "Jumlah Ekstraksi",
  //     },
  //     series,
  //   });

  //   this.echarts.chart4 = chart;
  // }

  renderExtractionStackedBarByCategoryAndClass() {
    const chartDom = document.getElementById("chart4");
    if (!chartDom) return;

    const data = this.state.extractionByCategory;
    if (!data || !data.length) {
      chartDom.innerHTML =
        "<p style='text-align:center'>Data tidak tersedia</p>";
      return;
    }

    // 1) Parse dan urutkan minggu
    const parseDate = (s) => {
      const [d, mon, y] = s.split(" ");
      const m = {
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
      }[mon];
      return new Date(+y, m, +d);
    };
    const weeks = Array.from(new Set(data.map((r) => r.week_label))).sort(
      (a, b) => parseDate(a) - parseDate(b)
    );
    const xWeeks = weeks.map((_, i) => `W${i + 1}`);

    // 2) Ambil kategori berdasarkan ID dan urutkan
    const categoryMap = new Map();
    data.forEach((r) => {
      const [catId, catName] = r.category_id;
      categoryMap.set(catId, catName);
    });
    const sortedCategoryEntries = Array.from(categoryMap.entries()).sort(
      (a, b) => a[0] - b[0]
    );
    const categories = sortedCategoryEntries.map(([_, name]) => name);

    // 3) Ambil kelas unik
    const classes = Array.from(new Set(data.map((r) => r.class_name)));

    // 4) Buat pivot: pivot[week][category][class] = jumlah
    const pivot = {};
    weeks.forEach((wk) => {
      pivot[wk] = {};
      categories.forEach((cat) => {
        pivot[wk][cat] = {};
        classes.forEach((cls) => {
          pivot[wk][cat][cls] = 0;
        });
      });
    });
    data.forEach((r) => {
      const week = r.week_label;
      const cat = r.category_id[1];
      const cls = r.class_name;
      pivot[week][cat][cls] = r.extraction_count;
    });

    // 5) Layout grid
    const cols = 3;
    const rows = Math.ceil(categories.length / cols);
    const perRowPx = 250;
    chartDom.style.height = `${rows * perRowPx + 120}px`;

    const grids = categories.map((_, idx) => ({
      left: `${(idx % cols) * (100 / cols + 1) + 2}%`,
      top: `${Math.floor(idx / cols) * (100 / rows + 1) + 15}%`,
      width: `${100 / cols - 2}%`,
      height: `${100 / rows - 10}%`,
      containLabel: true,
    }));

    // 6) Axis
    const xAxes = categories.map((_, ci) => ({
      type: "category",
      gridIndex: ci,
      data: xWeeks,
      axisLabel: {
        rotate: 45,
        fontSize: 9,
        interval: 0,
        margin: 6,
      },
      name: "Minggu",
    }));
    const yAxes = categories.map((_, ci) => ({
      type: "value",
      gridIndex: ci,
      name: "Jumlah Ekstraksi",
    }));

    // 7) Series: per kelas dalam tiap kategori
    const series = [];
    categories.forEach((cat, ci) => {
      classes.forEach((cls) => {
        series.push({
          name: cls,
          type: "bar",
          stack: cat,
          xAxisIndex: ci,
          yAxisIndex: ci,
          data: weeks.map((wk) => pivot[wk][cat][cls]),
        });
      });
    });

    // 8) Title per grid (tengah)
    const titlePerGrid = categories.map((cat, i) => {
      const topPercent = `${Math.floor(i / cols) * (100 / rows + 1) + 5}%`;
      const leftPercent = `${
        (i % cols) * (100 / cols + 1) + (100 / cols - 2) / 2
      }%`;
      return {
        text: cat,
        left: leftPercent,
        top: topPercent,
        textAlign: "center",
        textStyle: {
          fontSize: 12,
          fontWeight: "bold",
        },
      };
    });

    // 9) Render
    if (this.echarts.chart4) this.echarts.chart4.dispose();
    const chart = echarts.init(chartDom);
    chart.setOption({
      title: [
        {
          text: "Ekstraksi — Semua Minggu (per Kategori)",
          left: "center",
          top: 5,
        },
        ...titlePerGrid,
      ],
      legend: {
        data: classes,
        top: 40,
        type: "scroll",
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        confine: true,
      },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series: series,
    });

    this.echarts.chart4 = chart;
  }
}

LogbookClassAnalytics.template = "jtk_logbook_analytics.LogbookClassAnalytics";
registry
  .category("actions")
  .add("jtk_logbook_analytics.logbook_class_analytics", LogbookClassAnalytics);
