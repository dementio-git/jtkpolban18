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
      weeklyActivity: [],
      extraction_stats: [],
      extractionByCategory: [],
      extractionBySubcategory: [],
      extractionByLabel: [],
      extractionByNormalizedLabel: [],
      wordcloudData: [],
      wordcloudOverallData: [],
      selectedWeek: "all", // Menambahkan state untuk selected week
      weekLabels: [], // Menambahkan state untuk daftar minggu
    });
    this.orm = useService("orm");
    this.echarts = {};

    onWillStart(async () => {
      const pid = this.props.projectId;
      this.state.projectCourseId = pid;
      if (!pid) {
        this.state.projectCourseId = getRecordIdFromPath();
        if (!this.state.projectCourseId) {
          console.warn("projectCourseId belum tersedia");
          return;
        }
      }

      await this.loadStats();
      await this.loadWeeklyStats();
      await this.loadWeeklyActivity();
      await this.loadExtractionDescriptiveStats();
      await this.loadExtractionByCategory();
      await this.loadExtractionBySubcategory();
      await this.loadExtractionByLabel();
      await this.loadNormalizedByLabel(); // Panggil fungsi baru untuk memuat data normalisasi
      await this.loadWordcloud(); // Tambahkan pemanggilan loadWordcloud
      await this.loadWordcloudOverall(); // Tambahkan pemanggilan loadWordcloudOverall
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

  async loadWeeklyActivity() {
    const pid = this.state.projectCourseId;
    if (!pid) {
      console.warn("projectCourseId belum tersedia");
      this.state.weeklyActivity = [];
      return;
    }
    this.state.weeklyActivity = await this.orm.searchRead(
      "logbook.weekly.activity",
      [["project_course_id", "=", pid]],
      [
        "week_start_date",
        "week_end_date",
        "week_label",
        "logbook_count",
        "extraction_count",
        "extraction_ratio",
      ]
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
        "avg_norm_point",
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
        "avg_norm_point",
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

  async loadWordcloud() {
    const pid = this.state.projectCourseId;
    if (!pid) {
      this.state.wordcloudData = [];
      return;
    }

    // Mengambil data wordcloud untuk project tertentu
    this.state.wordcloudData = await this.orm.searchRead(
      "logbook.keyword.cloud",
      [["project_course_id", "=", pid]],
      ["keyword", "frequency", "freq_pct_week", "freq_rank_week", "week_id"]
    );

    // Menyiapkan week labels
    const uniqueWeeks = Array.from(
      new Set(this.state.wordcloudData.map((item) => item.week_id[1]))
    ).sort((a, b) => {
      // Mengasumsikan format minggu adalah "Week X" atau sejenisnya
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });
    this.state.weekLabels = uniqueWeeks;
  }

  async loadWordcloudOverall() {
    const pid = this.state.projectCourseId;
    if (!pid) {
      this.state.wordcloudOverallData = [];
      return;
    }
    // Mengambil data wordcloud overall untuk project tertentu
    this.state.wordcloudOverallData = await this.orm.searchRead(
      "logbook.keyword.cloud.overall",
      [["project_course_id", "=", pid]],
      ["keyword", "frequency", "freq_pct_overall", "freq_rank_overall"]
    );
  }

  onWordcloudWeekChange(event) {
    this.state.selectedWeek = event.target.value;
    this.renderWordcloudChart();
  }

  renderCharts() {
    this.renderProductivityTrendChart();
    this.renderWeeklyActivityChart();
    this.renderExtractionCategoryTrendChart();
    this.renderExtractionSubcategoryTrendChart();
    this.renderExtractionLabelFreqHeatmap();
    this.renderExtractionLabelPointHeatmap();
    this.renderExtractionLabelOverallRadarChart();
    this.renderWordcloudChart();
  }

  renderWordcloudChart() {
    const chartDom = document.getElementById("wordcloud");
    if (!chartDom) return;
    if (this.echarts.wordcloud) this.echarts.wordcloud.dispose();
    const chart = echarts.init(chartDom);

    // 1) Siapkan label minggu + "All"
    const weekLabels = Array.from(
      new Set(this.state.wordcloudData.map((d) => d.week_id[1]))
    ).sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || 0),
        nb = parseInt(b.match(/\d+/)?.[0] || 0);
      return na - nb;
    });
    weekLabels.push("All");

    // 2) Siapkan data per minggu & All
    const dataMap = {};
    weekLabels.forEach((lbl) => {
      let arr;
      if (lbl === "All") {
        // PAKAI this.state.wordcloudOverallData untuk All
        arr = (this.state.wordcloudOverallData || []).map((d) => ({
          name: d.keyword,
          value: d.frequency,
        }));
      } else {
        arr = this.state.wordcloudData
          .filter((d) => d.week_id[1] === lbl)
          .map((d) => ({ name: d.keyword, value: d.frequency }));
      }
      dataMap[lbl] = arr.sort((a, b) => b.value - a.value).slice(0, 200);
    });

    // 3) Bangun option dengan timeline + autoplay
    const option = {
      baseOption: {
        timeline: {
          axisType: "category",
          autoPlay: false,
          playInterval: 3000,
          data: weekLabels.map((w, i) => (w === "All" ? "All" : `W${i + 1}`)),
          label: {
            formatter: (_, idx) =>
              weekLabels[idx] === "All" ? "All" : `W${idx + 1}`,
          },
          // tambahkan controlStyle jika mau positioning custom
        },
        title: { text: "Word Cloud Keyword Logbook", left: "center" },
        tooltip: {},
        // ==== ANIMASI HALUS DI SINI ====
        animationDuration: 1000, // durasi animasi frame masuk (ms)
        animationDurationUpdate: 1000, // durasi update data antar frame
        animationEasing: "cubicOut", // easing untuk masuk
        animationEasingUpdate: "cubicOut", // easing untuk update
        // ==============================
        series: [
          {
            type: "wordCloud",
            gridSize: 8,
            sizeRange: [12, 40],
            rotationRange: [-45, 90],
            textStyle: {
              color: () => `hsl(${Math.random() * 360},70%,50%)`,
            },
            data: [], // akan diisi via options[]
          },
        ],
      },
      options: weekLabels.map((lbl) => ({
        series: [{ data: dataMap[lbl] }],
      })),
    };

    this.echarts.wordcloud?.dispose();
    this.echarts.wordcloud = echarts.init(chartDom);
    this.echarts.wordcloud.setOption(option);
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, "0")}/${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;
  }

  renderProductivityTrendChart() {
    const chartDom = document.getElementById("chart_productivity");
    if (!chartDom) return;
    if (this.echarts.chart_productivity) {
      this.echarts.chart_productivity.dispose();
    }
    const chart = echarts.init(chartDom);

    const weekly = this.state.weeklyStats;
    const overall = this.state.stats.length ? this.state.stats[0] : {};

    // Generate week labels
    const weekLabels = weekly.map((_, i) => `W${i + 1}`);

    const option = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params) => {
          const index = params[0].dataIndex;
          const s = weekly[index];
          let result = `Minggu ${index + 1} (${this.formatDate(
            s.week_start_date
          )} - ${this.formatDate(s.week_end_date)})<br/>`;

          params.forEach((param) => {
            let value = param.value;
            let formattedValue = "";

            if (param.seriesName === "Jumlah Logbook") {
              formattedValue = `${value} logbook`;
            } else if (param.seriesName === "Mahasiswa Aktif") {
              formattedValue = `${value} mahasiswa`;
            } else if (
              param.seriesName === "Rata-rata Produktivitas Logbook/Mahasiswa"
            ) {
              formattedValue = `${value.toFixed(2)} logbook/mhs`;
            }

            result += `${param.marker}${param.seriesName}: ${formattedValue}<br/>`;
          });
          return result;
        },
      },
      legend: {
        data: [
          "Jumlah Logbook",
          "Mahasiswa Aktif",
          "Rata-rata Produktivitas Logbook/Mahasiswa",
        ],
        top: 40,
      },
      grid: {
        right: "15%",
        top: "25%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: weekLabels,
        axisLabel: { interval: 0 },
      },
      yAxis: [
        {
          type: "value",
          name: "Jumlah",
          position: "left",
          axisLine: { show: true },
          splitLine: { show: false },
          axisLabel: {
            formatter: "{value}",
          },
        },
        {
          type: "value",
          name: "Rata-rata Produktivitas",
          position: "right",
          offset: 80,
          axisLine: { show: true },
          splitLine: { show: false },
          axisLabel: {
            formatter: "{value}",
          },
        },
      ],
      series: [
        {
          name: "Jumlah Logbook",
          type: "bar",
          data: weekly.map((s) => s.avg_logbooks_per_week),
          yAxisIndex: 0,
          itemStyle: { color: "#5470C6" },
          markLine: {
            symbol: "none",
            label: {
              formatter: "Rata-rata\nJumlah Logbook:\n{c}",
              position: "end",
              lineHeight: 15,
              fontSize: 10,
            },
            data: [{ yAxis: overall.avg_logbooks_per_week }],
            lineStyle: { type: "dashed", color: "#5470C6" },
          },
        },
        {
          name: "Mahasiswa Aktif",
          type: "line",
          data: weekly.map((s) => s.avg_active_students_per_week),
          yAxisIndex: 0,
          itemStyle: { color: "#91CC75" },
          symbol: "circle",
          markLine: {
            symbol: "none",
            label: {
              formatter: "Rata-rata\nMahasiswa Aktif:\n{c}",
              position: "end",
              lineHeight: 15,
              fontSize: 10,
            },
            data: [{ yAxis: overall.avg_active_students_per_week }],
            lineStyle: { type: "dashed", color: "#91CC75" },
          },
        },
        {
          name: "Rata-rata Produktivitas Logbook/Mahasiswa",
          type: "line",
          data: weekly.map((s) =>
            parseFloat(s.avg_logbooks_per_student_week.toFixed(2))
          ),
          yAxisIndex: 1,
          itemStyle: { color: "#EE6666" },
          symbol: "circle",
          lineStyle: { type: "dashed" },
          markLine: {
            symbol: "none",
            label: {
              formatter: "Rata-rata\nProduktivitas\nLogbook Mahasiswa:\n{c}",
              position: "end",
              lineHeight: 15,
              fontSize: 10,
            },
            data: [{ yAxis: overall.avg_logbooks_per_student_week }],
            lineStyle: { type: "dashed", color: "#EE6666" },
          },
        },
      ],
    };

    chart.setOption(option);
    this.echarts.chart_productivity = chart;
  }

  renderWeeklyActivityChart() {
    const chartDom = document.getElementById("chart_activity");
    if (!chartDom) return;
    if (this.echarts.chart_activity) {
      this.echarts.chart_activity.dispose();
    }
    const chart = echarts.init(chartDom);

    const weekLabels = [
      ...new Set(
        this.state.weeklyActivity
          .sort(
            (a, b) => new Date(a.week_start_date) - new Date(b.week_start_date)
          )
          .map((s) => s.week_label)
      ),
    ];

    // Hitung maxRatio untuk y-axis
    const maxRatio = Math.max(
      ...this.state.weeklyActivity.map((d) => d.extraction_ratio)
    );
    const yAxisMaxRatio = Math.ceil(maxRatio * 1.1);

    const option = {
      title: {
        text: "Aktivitas Logbook & Ekstraksi",
        left: "center",
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: function (params) {
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((param) => {
            let value = param.value;
            let formattedValue = "";

            if (param.seriesName === "Jumlah Ekstraksi") {
              formattedValue = `${value} ekstraksi`;
            } else if (param.seriesName === "Jumlah Logbook") {
              formattedValue = `${value} logbook`;
            } else if (param.seriesName === "Rasio Ekstraksi") {
              formattedValue = `${value.toFixed(2)}x (${(value * 100).toFixed(
                1
              )}%)`;
            }

            result += `${param.marker}${param.seriesName}: ${formattedValue}<br/>`;
          });
          return result;
        },
      },
      legend: {
        top: 40,
        data: ["Jumlah Ekstraksi", "Jumlah Logbook", "Rasio Ekstraksi"],
      },
      grid: {
        right: "15%",
        top: "25%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: weekLabels,
        axisLabel: { interval: 0 },
      },
      yAxis: [
        {
          type: "value",
          name: "Jumlah Ekstraksi",
          position: "left",
          axisLine: { show: true },
          splitLine: { show: false },
        },
        {
          type: "value",
          name: "Jumlah Logbook",
          position: "right",
          offset: 0,
          axisLine: { show: true },
          splitLine: { show: false },
        },
        {
          type: "value",
          name: "Rasio Ekstraksi",
          min: 0,
          max: yAxisMaxRatio,
          position: "right",
          offset: 80,
          axisLabel: {
            formatter: "{value}x",
          },
          axisLine: { show: true },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Jumlah Ekstraksi",
          type: "bar",
          data: this.state.weeklyActivity.map((w) => w.extraction_count),
          yAxisIndex: 0,
          itemStyle: { color: "#5470C6" },
          markLine: {
            symbol: "none",
            label: {
              formatter: "Rata-rata\nJumlah Ekstraksi:\n{c}",
              position: "end",
              lineHeight: 15,
              fontSize: 10,
            },
            data: [
              {
                yAxis:
                  this.state.weeklyActivity.reduce(
                    (sum, w) => sum + w.extraction_count,
                    0
                  ) / this.state.weeklyActivity.length,
              },
            ],
            lineStyle: { type: "dashed", color: "#5470C6" },
          },
        },
        {
          name: "Jumlah Logbook",
          type: "line",
          data: this.state.weeklyActivity.map((w) => w.logbook_count),
          yAxisIndex: 1,
          symbol: "circle",
          itemStyle: { color: "#91CC75" },
          markLine: {
            symbol: "none",
            label: {
              formatter: "Rata-rata\nJumlah Logbook:\n{c}",
              position: "end",
              lineHeight: 15,
              fontSize: 10,
            },
            data: [
              {
                yAxis:
                  this.state.weeklyActivity.reduce(
                    (sum, w) => sum + w.logbook_count,
                    0
                  ) / this.state.weeklyActivity.length,
              },
            ],
            lineStyle: { type: "dashed", color: "#91CC75" },
          },
        },
        {
          name: "Rasio Ekstraksi",
          type: "line",
          data: this.state.weeklyActivity.map((w) => w.extraction_ratio),
          yAxisIndex: 2,
          symbol: "circle",
          lineStyle: { type: "dashed" },
          itemStyle: { color: "#EE6666" },
          markLine: {
            symbol: "none",
            label: {
              formatter: "Rata-rata\nRasio Ekstraksi:\n{c}",
              position: "end",
              lineHeight: 15,
              fontSize: 10,
            },
            data: [
              {
                yAxis:
                  this.state.weeklyActivity.reduce(
                    (sum, w) => sum + w.extraction_ratio,
                    0
                  ) / this.state.weeklyActivity.length,
              },
            ],
            lineStyle: { type: "dashed", color: "#EE6666" },
          },
        },
      ],
    };

    chart.setOption(option);
    this.echarts.chart_activity = chart;
  }

  renderExtractionCategoryTrendChart() {
    const chartDom = document.getElementById("chart_extraction_category");
    if (!chartDom) return;

    const data = this.state.extractionByCategory;
    if (!data || !data.length) {
      chartDom.innerHTML =
        "<p style='text-align:center'>Data tidak tersedia</p>";
      return;
    }

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

    // 1. Urutkan minggu
    const weeks = Array.from(new Set(data.map((r) => r.week_label))).sort(
      (a, b) => parseDate(a) - parseDate(b)
    );
    const xWeeks = weeks.map((_, i) => `W${i + 1}`);

    // 2. Ambil daftar kategori (sorted by ID)
    const catPairs = Array.from(
      new Map(data.map((r) => [r.category_id[0], r.category_id[1]])).entries()
    ).sort((a, b) => a[0] - b[0]);
    const categoryIds = catPairs.map((p) => p[0]);
    const categoryNames = catPairs.map((p) => p[1]);

    // 3. Build pivot data
    const pivot = {};
    weeks.forEach((wk) => {
      pivot[wk] = {};
      categoryIds.forEach((cid) => {
        pivot[wk][cid] = 0;
      });
    });

    data.forEach((r) => {
      const wk = r.week_label;
      const cid = r.category_id[0];
      pivot[wk][cid] = r.extraction_count;
    });

    const baseColors = [
      "#5470C6",
      "#91CC75",
      "#EE6666",
      "#73C0DE",
      "#3BA272",
      "#FC8452",
      "#9A60B4",
      "#EA7CCC",
    ];

    function generateColorVariants(baseColor) {
      const color = echarts.color.lift(baseColor, 0);
      return [
        echarts.color.lift(color, 0.2),
        color,
        echarts.color.lift(color, -0.2),
      ];
    }

    const averages = {};
    categoryIds.forEach((catId, ci) => {
      const catName = categoryNames[ci];
      let totalCount = 0;
      let totalPoint = 0;
      let weekCount = 0;

      weeks.forEach((wk) => {
        totalCount += pivot[wk][catId];
        const record = data.find(
          (r) => r.week_label === wk && r.category_id[0] === catId
        );
        if (record?.avg_norm_point) {
          totalPoint += parseFloat(record.avg_norm_point);
          weekCount++;
        }
      });

      averages[catName] = {
        count: totalCount / weeks.length,
        point: weekCount ? totalPoint / weekCount : 0,
      };
    });

    const averagesText = categoryIds
      .map((catId) => {
        const catName = categoryNames[categoryIds.indexOf(catId)];
        const avg = averages[catName];
        return `${catName}: Rata-rata Ekstraksi: ${avg.count.toFixed(
          1
        )} | Point: ${avg.point.toFixed(2)}`;
      })
      .reverse();

    // Generate series
    const series = [];
    categoryIds.forEach((catId, ci) => {
      const catName = categoryNames[ci];
      const baseColor = baseColors[ci % baseColors.length];
      const variants = generateColorVariants(baseColor);

      series.push({
        name: `${catName} (Jumlah)`,
        type: "bar",
        stack: "count",
        data: weeks.map((wk) => pivot[wk][catId]),
        itemStyle: { color: variants[1] },
        emphasis: { focus: "series" },
      });

      series.push({
        name: `${catName} (Point)`,
        type: "line",
        yAxisIndex: 1,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: {
          width: 2,
          type: "solid",
        },
        itemStyle: { color: variants[2] },
        data: weeks.map((wk) => {
          const record = data.find(
            (r) => r.week_label === wk && r.category_id[0] === catId
          );
          return record?.avg_norm_point?.toFixed(2) || 0;
        }),
      });
    });

    // Chart options
    const option = {
      title: [
        {},
        ...averagesText.map((text, idx) => ({
          text: text,
          bottom: 20 + idx * 16,
          left: 10,
          textStyle: {
            fontSize: 11,
            fontWeight: "normal",
          },
        })),
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: function (params) {
          let result = `${params[0].axisValue}<br/>`;
          let total = 0;

          const bars = params.filter((p) => p.seriesName.includes("(Jumlah)"));
          const lines = params.filter((p) => p.seriesName.includes("(Point)"));

          bars.forEach((param) => {
            total += param.value;
            result += `${param.marker}${param.seriesName}: ${param.value}<br/>`;
          });
          result += `${"-".repeat(10)}<br/>Total: ${total}<br/>`;

          lines.forEach((param) => {
            result += `${param.marker}${param.seriesName}: ${parseFloat(
              param.value
            ).toFixed(2)}<br/>`;
          });

          return result;
        },
      },
      legend: {
        type: "scroll",
        top: 10,
        padding: [5, 50],
        height: 50,
        textStyle: { fontSize: 11 },
        width: "90%",
        left: "center",
        formatter: (name) => name.replace(/\s-\s[^(]+/, ""),
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: 20 + averagesText.length * 16 + 20,
        top: "20%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: xWeeks,
        axisLabel: {
          rotate: 45,
          interval: 0,
        },
      },
      yAxis: [
        {
          type: "value",
          name: "Jumlah Ekstraksi",
          position: "left",
        },
        {
          type: "value",
          name: "Point",
          position: "right",
          offset: 0,
          min: 0,
          max: 1,
          axisLabel: {
            formatter: (value) => value.toFixed(2),
          },
        },
      ],
      series: series,
    };

    // Render chart
    if (this.echarts.chart4) this.echarts.chart4.dispose();
    const chart = echarts.init(chartDom);
    chart.setOption(option);
    this.echarts.chart4 = chart;
  }

  // === Grafik Tren Ekstraksi per Subkategori ===
  renderExtractionSubcategoryTrendChart() {
    const chartDom = document.getElementById("chart_extraction_subcategory");
    if (!chartDom) return;

    const chart = echarts.init(chartDom);
    const allData = this.state.extractionBySubcategory;

    if (!allData || allData.length === 0) {
      chartDom.innerHTML =
        "<p style='text-align:center'>Data tidak tersedia</p>";
      return;
    }

    // 1) Kumpulkan pasangan [subcategory_id, subcategory_name] unik
    const mapSub = new Map();
    allData.forEach((r) => {
      const [subId, subName] = r.subcategory_id;
      mapSub.set(subId, subName);
    });
    const subPairs = Array.from(mapSub.entries()).sort((a, b) => a[0] - b[0]);
    const subIds = subPairs.map((p) => p[0]);
    const subNames = subPairs.map((p) => p[1]);

    // 2) Ambil semua week_label unik, urutkan kronologis
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

    // 3) Build pivot data
    const pivot = {};
    weekLabels.forEach((wk) => {
      pivot[wk] = {};
      subIds.forEach((sid) => {
        pivot[wk][sid] = 0;
      });
    });

    allData.forEach((r) => {
      const wk = r.week_label;
      const sid = r.subcategory_id[0];
      pivot[wk][sid] = r.extraction_count;
    });

    // Color config
    const baseColors = [
      "#5470C6",
      "#91CC75",
      "#EE6666",
      "#73C0DE",
      "#3BA272",
      "#FC8452",
      "#9A60B4",
      "#EA7CCC",
    ];

    function generateColorVariants(baseColor) {
      const color = echarts.color.lift(baseColor, 0);
      return [
        echarts.color.lift(color, 0.2),
        color,
        echarts.color.lift(color, -0.2),
      ];
    }
    const subAverages = {};
    subIds.forEach((subId, si) => {
      const subName = subNames[si];
      let totalCount = 0;
      let totalPoint = 0;
      let weekCount = 0;

      weekLabels.forEach((wk) => {
        totalCount += pivot[wk][subId];
        const record = allData.find(
          (r) => r.week_label === wk && r.subcategory_id[0] === subId
        );
        if (record?.avg_norm_point) {
          totalPoint += parseFloat(record.avg_norm_point);
          weekCount++;
        }
      });

      subAverages[subName] = {
        count: totalCount / weekLabels.length,
        point: weekCount ? totalPoint / weekCount : 0,
      };
    });

    const subAveragesText = subIds
      .map((subId) => {
        const subName = subNames[subIds.indexOf(subId)];
        const avg = subAverages[subName];
        return `${subName}: Rata-rata Ekstraksi: ${avg.count.toFixed(
          1
        )} | Point: ${avg.point.toFixed(2)}`;
      })
      .reverse();

    // Generate series
    const series = [];
    subIds.forEach((subId, si) => {
      const subName = subNames[si];
      const baseColor = baseColors[si % baseColors.length];
      const variants = generateColorVariants(baseColor);

      series.push({
        name: `${subName} (Jumlah)`,
        type: "bar",
        stack: "count",
        data: weekLabels.map((wk) => pivot[wk][subId]),
        itemStyle: { color: variants[1] },
        emphasis: { focus: "series" },
      });

      series.push({
        name: `${subName} (Point)`,
        type: "line",
        yAxisIndex: 1,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: {
          width: 2,
          type: "solid",
        },
        itemStyle: { color: variants[2] },
        data: weekLabels.map((wk) => {
          const record = allData.find(
            (r) => r.week_label === wk && r.subcategory_id[0] === subId
          );
          return record?.avg_norm_point?.toFixed(2) || 0;
        }),
      });
    });

    // Chart options
    const option = {
      title: [
        {},
        ...subAveragesText.map((text, idx) => ({
          text: text,
          bottom: 20 + idx * 16,
          left: 10,
          textStyle: {
            fontSize: 11,
            fontWeight: "normal",
          },
        })),
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: function (params) {
          let result = `${params[0].axisValue}<br/>`;
          let total = 0;

          const bars = params.filter((p) => p.seriesName.includes("(Jumlah)"));
          const lines = params.filter((p) => p.seriesName.includes("(Point)"));

          bars.forEach((param) => {
            total += param.value;
            result += `${param.marker}${param.seriesName}: ${param.value}<br/>`;
          });
          result += `${"-".repeat(10)}<br/>Total: ${total}<br/>`;

          lines.forEach((param) => {
            result += `${param.marker}${param.seriesName}: ${parseFloat(
              param.value
            ).toFixed(2)}<br/>`;
          });

          return result;
        },
      },
      legend: {
        type: "scroll",
        top: 10,
        padding: [5, 50],
        height: 50,
        textStyle: { fontSize: 11 },
        width: "90%",
        left: "center",
        formatter: (name) => name.replace(/\s-\s[^(]+/, ""),
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: 20 + subAveragesText.length * 16 + 20,
        top: "20%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: weekIndexLabels,
        axisLabel: {
          rotate: 45,
          interval: 0,
        },
      },
      yAxis: [
        {
          type: "value",
          name: "Jumlah Ekstraksi",
          position: "left",
        },
        {
          type: "value",
          name: "Point",
          position: "right",
          offset: 0,
          min: 0,
          max: 1,
          axisLabel: {
            formatter: (value) => value.toFixed(2),
          },
        },
      ],
      series: series,
    };

    // Render chart
    if (this.echarts.chart5) this.echarts.chart5.dispose();
    chart.setOption(option);
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
          formatter: function (name) {
            // Pecah berdasarkan spasi
            const parts = name.split(" ");
            let lines = [];
            let current = "";
            parts.forEach((p) => {
              if ((current + " " + p).length > 18) {
                lines.push(current);
                current = p;
              } else {
                current += (current ? " " : "") + p;
              }
            });
            if (current) lines.push(current);
            return lines.join("\n"); // pecah ke baris baru
          },
          rich: {
            a: {
              lineHeight: 14,
            },
          },
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

LogbookProjectAnalytics.props = {
  projectId: { type: Number },
};

LogbookProjectAnalytics.template =
  "jtk_logbook_analytics.LogbookProjectAnalytics";
registry
  .category("actions")
  .add(
    "jtk_logbook_analytics.logbook_project_analytics",
    LogbookProjectAnalytics
  );
