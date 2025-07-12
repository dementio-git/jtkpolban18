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
      weeklyActivity: [],
      extractionDescriptiveByClass: [],
      extractionByCategory: [],
      extractionBySubCategory: [],
      extractionByLabel: [],
      extractionByNormalizedLabel: [],
    });
    this.echarts = {};

    onWillStart(async () => {
      // ambil langsung dari prop yang parent sudah set
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
      await this.loadExtractionDescriptiveStatsByClass();
      await this.loadExtractionByCategory();
      await this.loadExtractionBySubcategoryClass();
      await this.loadExtractionByLabel();
      await this.loadNormalizedByLabel();
    });

    onMounted(() => {
      this.renderCharts();
    });
  }

  async loadWeeklyStats() {
    const pid = this.state.projectCourseId;
    if (!pid) {
      console.warn("projectCourseId belum tersediaAAAAABBB");
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

  async loadWeeklyActivity() {
    const pid = this.state.projectCourseId;
    if (!pid) {
      this.state.weeklyActivity = [];
      return;
    }
    this.state.weeklyActivity = await this.orm.searchRead(
      "logbook.weekly.activity.class",
      [["project_course_id", "=", pid]],
      [
        "class_id",
        "class_name",
        "week_start_date",
        "week_end_date",
        "week_label",
        "logbook_count",
        "extraction_count",
        "extraction_ratio",
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
        "avg_norm_point",
      ]
    );
  }

  async loadExtractionBySubcategoryClass() {
    this.state.extractionBySubcategoryClass = await this.orm.searchRead(
      "logbook.extraction.weekly.subcategory.class",
      [],
      [
        "week_start_date",
        "week_end_date",
        "week_label",
        "subcategory_id",
        "class_name",
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
      "logbook.extraction.weekly.label.class",
      [["project_course_id", "=", pid]],
      [
        "class_id",
        "class_name",
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
    this.state.normByLabel = await this.orm.searchRead(
      "logbook.extraction.weekly.label.norm.class",
      [["project_course_id", "=", pid]],
      [
        "class_id",
        "class_name",
        "week_label",
        "label_id",
        "avg_norm_point",
        "category_id",
        "subcategory_id",
      ]
    );
  }

  renderCharts() {
    this.renderClassProductivityChart();
    this.renderWeeklyActivityChart();
    this.renderExtractionStackedBarByCategoryAndClass();
    this.renderExtractionSubcategoryTrendByClass();
    this.renderExtractionLabelFreqHeatmapClass();
    this.renderExtractionLabelPointHeatmapClass();
    this.renderExtractionLabelOverallRadarChartClass();
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

  renderClassProductivityChart() {
    const chartDom = document.getElementById("chart_productivity_class");
    if (!chartDom) return;
    if (this.echarts.chart_productivity_class) {
      this.echarts.chart_productivity_class.dispose();
    }
    const chart = echarts.init(chartDom);

    // Group data by class
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

    // Generate warna dasar untuk setiap kelas
    const baseColors = [
      "#5470C6", // Biru
      "#91CC75", // Hijau
      "#EE6666", // Merah
      "#73C0DE", // Biru Muda
      "#3BA272", // Hijau Tua
      "#FC8452", // Oranye
      "#9A60B4", // Ungu
      "#EA7CCC", // Pink
    ];

    const averages = {};
    Object.entries(grouped).forEach(([className, stats]) => {
      averages[className] = {
        logbook:
          stats.reduce((sum, s) => sum + s.avg_logbooks_per_week, 0) /
          stats.length,
        active:
          stats.reduce((sum, s) => sum + s.avg_active_students_per_week, 0) /
          stats.length,
        productivity:
          stats.reduce((sum, s) => sum + s.avg_logbooks_per_student_week, 0) /
          stats.length,
      };
    });

    const averagesText = Object.entries(averages).map(([className, avg]) => {
      return [
        `${className}:`,
        `Rata-rata Logbook: ${avg.logbook.toFixed(1)}`,
        `Rata-rata Mahasiswa Aktif: ${avg.active.toFixed(1)}`,
        `Rata-rata Produktivitas: ${avg.productivity.toFixed(2)}`,
      ].join(" | ");
    });

    // Fungsi untuk menghasilkan variasi warna
    function generateColorVariants(baseColor) {
      const color = echarts.color.lift(baseColor, 0); // Convert to RGB
      return [
        echarts.color.lift(color, 0.2), // Light version
        color, // Normal version
        echarts.color.lift(color, -0.2), // Dark version
      ];
    }

    // Generate color map untuk setiap kelas
    const classNames = Object.keys(grouped).sort();
    const classColors = {};
    classNames.forEach((className, idx) => {
      const baseColor = baseColors[idx % baseColors.length];
      classColors[className] = {
        base: baseColor,
        variants: generateColorVariants(baseColor),
      };
    });

    // Generate series dengan warna yang konsisten per kelas
    const allSeries = [];
    Object.entries(grouped).forEach(([className, stats]) => {
      const colors = classColors[className].variants;

      // Logbook series (bar)
      allSeries.push({
        name: `Jumlah Logbook - ${className}`,
        type: "bar",
        data: stats.map((s) => s.avg_logbooks_per_week),
        yAxisIndex: 0,
        itemStyle: { color: colors[0] }, // Light shade
      });

      // Active Students series (line)
      allSeries.push({
        name: `Mahasiswa Aktif - ${className}`,
        type: "line",
        data: stats.map((s) => s.avg_active_students_per_week),
        yAxisIndex: 0,
        itemStyle: { color: colors[1] }, // Normal shade
        symbol: "circle",
      });

      // Productivity series (line)
      allSeries.push({
        name: `Produktivitas - ${className}`,
        type: "line",
        data: stats.map((s) =>
          parseFloat(s.avg_logbooks_per_student_week.toFixed(2))
        ),
        yAxisIndex: 1,
        itemStyle: { color: colors[2] }, // Dark shade
        symbol: "circle",
        lineStyle: { type: "dashed" },
      });
    });

    const option = {
      title: [
        {},
        // Tambahkan rata-rata sebagai subtitle di bawah
        ...averagesText.map((text, idx) => ({
          text: text,
          bottom: 10 + idx * 16, // Posisikan dari bawah
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
        formatter: (params) => {
          const index = params[0].dataIndex;
          const weekData = this.state.weeklyStats.find(
            (s) => s.week_label === weekLabels[index]
          );

          let result = `Minggu ${index + 1} (${this.formatDate(
            weekData.week_start_date
          )} - ${this.formatDate(weekData.week_end_date)})<br/>`;

          params.forEach((param) => {
            let value = param.value;
            let formattedValue = "";

            if (param.seriesName.includes("Jumlah Logbook")) {
              formattedValue = `${value} logbook`;
            } else if (param.seriesName.includes("Mahasiswa Aktif")) {
              formattedValue = `${value} mahasiswa`;
            } else if (param.seriesName.includes("Produktivitas")) {
              formattedValue = `${value.toFixed(2)} logbook/mhs`;
            }

            result += `${param.marker}${param.seriesName}: ${formattedValue}<br/>`;
          });
          return result;
        },
      },
      legend: {
        type: "scroll",
        top: 40,
        padding: [5, 10],
      },
      grid: {
        right: "15%",
        top: "25%",
        bottom: 10 + averagesText.length * 16 + 20, // Sesuaikan bottom margin untuk text rata-rata
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
        },
        {
          type: "value",
          name: "Rata-rata Produktivitas",
          position: "right",
          offset: 80,
          axisLine: { show: true },
          splitLine: { show: false },
        },
      ],
      series: allSeries,
    };

    chart.setOption(option);
    this.echarts.chart_productivity_class = chart;
  }

  renderWeeklyActivityChart() {
    const chartDom = document.getElementById("chart_activity_class");
    if (!chartDom) return;
    if (this.echarts.chart_activity_class) {
      this.echarts.chart_activity_class.dispose();
    }
    const chart = echarts.init(chartDom);

    const grouped = {};
    for (const stat of this.state.weeklyActivity) {
      if (!grouped[stat.class_name]) {
        grouped[stat.class_name] = [];
      }
      grouped[stat.class_name].push(stat);
    }

    // Initialize maxRatio before using it
    let maxRatio = 0;
    Object.values(grouped).forEach((stats) => {
      stats.forEach((stat) => {
        if (stat.extraction_ratio > maxRatio) {
          maxRatio = stat.extraction_ratio;
        }
      });
    });

    for (const stat of this.state.weeklyActivity) {
      if (!grouped[stat.class_name]) {
        grouped[stat.class_name] = [];
      }
      grouped[stat.class_name].push(stat);
    }
    const weekLabels = [
      ...new Set(
        this.state.weeklyActivity
          .sort(
            (a, b) => new Date(a.week_start_date) - new Date(b.week_start_date)
          )
          .map((s) => s.week_label)
      ),
    ];

    const averages = {};
    Object.entries(grouped).forEach(([className, stats]) => {
      averages[className] = {
        extraction:
          stats.reduce((sum, s) => sum + s.extraction_count, 0) / stats.length,
        logbook:
          stats.reduce((sum, s) => sum + s.logbook_count, 0) / stats.length,
        ratio:
          stats.reduce((sum, s) => sum + s.extraction_ratio, 0) / stats.length,
      };
    });

    // Format averages text
    const averagesText = Object.entries(averages).map(([className, avg]) => {
      return [
        `${className}:`,
        `Rata-rata Ekstraksi: ${avg.extraction.toFixed(1)}`,
        `Rata-rata Logbook: ${avg.logbook.toFixed(1)}`,
        `Rata-rata Rasio: ${avg.ratio.toFixed(2)}x`,
      ].join(" | ");
    });

    // Bulatkan ke atas ke nilai yang lebih bagus untuk ditampilkan
    const yAxisMaxRatio = Math.ceil(maxRatio * 1.1);

    // Series untuk setiap kelas
    const allSeries = [];

    // Generate warna dasar untuk setiap kelas
    const baseColors = [
      "#5470C6", // Biru
      "#91CC75", // Hijau
      "#EE6666", // Merah
      "#73C0DE", // Biru Muda
      "#3BA272", // Hijau Tua
      "#FC8452", // Oranye
      "#9A60B4", // Ungu
      "#EA7CCC", // Pink
    ];

    // Fungsi untuk menghasilkan variasi warna (light, normal, dark)
    function generateColorVariants(baseColor) {
      const color = echarts.color.lift(baseColor, 0); // Convert to RGB
      return [
        echarts.color.lift(color, 0.2), // Light version
        color, // Normal version
        echarts.color.lift(color, -0.2), // Dark version
      ];
    }

    // Generate color map untuk setiap kelas
    const classNames = Object.keys(grouped).sort();
    const classColors = {};
    classNames.forEach((className, idx) => {
      const baseColor = baseColors[idx % baseColors.length];
      classColors[className] = {
        base: baseColor,
        variants: generateColorVariants(baseColor),
      };
    });

    Object.entries(grouped).forEach(([className, stats]) => {
      const colors = classColors[className].variants;
      allSeries.push({
        name: `Jumlah Ekstraksi - ${className}`,
        type: "bar",
        data: stats.map((s) => s.extraction_count),
        yAxisIndex: 0,
        color: colors[0], // Light shade
      });

      // Jumlah Logbook
      allSeries.push({
        name: `Logbook - ${className}`,
        type: "line",
        data: stats.map((s) => s.logbook_count),
        yAxisIndex: 1,
        color: colors[1], // Normal shade
      });

      // Rasio Ekstraksi
      allSeries.push({
        name: `Rasio Ekstraksi - ${className}`,
        type: "line",
        data: stats.map((s) => s.extraction_ratio),
        yAxisIndex: 2,
        lineStyle: {
          type: "dashed",
        },
        symbol: "circle",
        color: colors[2], // Dark shade
      });
    });

    // Opsi chart
    const option = {
      title: [
        {},
        // Tambahkan rata-rata sebagai subtitle di bawah
        ...averagesText.map((text, idx) => ({
          text: text,
          bottom: 20 + idx * 16, // Posisikan dari bawah
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
          params.forEach((param) => {
            let value = param.value;
            let formattedValue = "";
            if (param.seriesName.includes("Jumlah Ekstraksi")) {
              formattedValue = `${value} ekstraksi`;
            } else if (param.seriesName.includes("Logbook")) {
              formattedValue = `${value} logbook`;
            } else if (param.seriesName.includes("Rasio")) {
              formattedValue = `${value.toFixed(2)}x (${value * 100}%)`;
            }

            result += `${param.marker}${param.seriesName}: ${formattedValue}<br/>`;
          });
          return result;
        },
      },
      legend: {
        top: 40,
        type: "scroll",
        padding: [5, 10],
        selected: {},
        emphasis: {
          selectorLabel: {
            show: true,
          },
        },
      },
      series: allSeries.map((series) => ({
        ...series,
        legendHoverLink: true,
        emphasis: {
          focus: "series",
          blurScope: "coordinateSystem",
          scale: true,
          lineStyle:
            series.type === "line"
              ? {
                  width: 4,
                }
              : undefined,
          itemStyle:
            series.type === "bar"
              ? {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: "rgba(0, 0, 0, 0.5)",
                }
              : undefined,
        },
      })),
      grid: {
        right: "15%", // beri ruang lebih di kanan
        top: "25%",
        containLabel: true, // pastikan label axis masuk hitungan
        bottom: 10 + averagesText.length * 16 + 60, // Sesuaikan bottom margin untuk text rata-rata
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
          nameLocation: "middle",
          nameGap: 50,
          splitLine: { show: false },
        },
        {
          type: "value",
          name: "Jumlah Logbook",
          position: "right",
          offset: 0, // axis pertama di kanan
          nameLocation: "middle",
          nameGap: 50,
          nameRotate: 90,
          axisLine: { show: true },
          axisTick: { show: true },
          splitLine: { show: false },
        },
        {
          type: "value",
          name: "Rasio Ekstraksi",
          position: "right",
          offset: 80, // geser lebih jauh ke kanan
          nameLocation: "middle",
          nameGap: 70, // jarak nama axis dari axis
          nameRotate: 90,
          axisLabel: {
            formatter: "{value}x",
          },
          axisLine: { show: true },
          axisTick: { show: true },
          splitLine: { show: false },
          min: 0,
          max: yAxisMaxRatio,
        },
      ],
    };

    chart.setOption(option);
    this.echarts.chart_activity_class = chart;
  }

  renderExtractionStackedBarByCategoryAndClass() {
    const chartDom = document.getElementById("chart_extraction_category_class");
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

    // 3. Ambil daftar kelas
    const classes = Array.from(new Set(data.map((r) => r.class_name))).sort();

    // 4. Bangun pivot[class][week][category] = count
    const pivot = {};
    classes.forEach((cls) => {
      pivot[cls] = {};
      weeks.forEach((wk) => {
        pivot[cls][wk] = {};
        categoryIds.forEach((cid) => {
          pivot[cls][wk][cid] = 0;
        });
      });
    });
    data.forEach((r) => {
      const cls = r.class_name;
      const wk = r.week_label;
      const cid = r.category_id[0];
      pivot[cls][wk][cid] = r.extraction_count;
    });

    const avgPoints = {};
    classes.forEach((cls) => {
      weeks.forEach((wk) => {
        let totalPoints = 0;
        let totalCount = 0;
        categoryIds.forEach((catId) => {
          const count = pivot[cls][wk][catId];
          totalCount += count;
          const record = data.find(
            (r) =>
              r.class_name === cls &&
              r.week_label === wk &&
              r.category_id[0] === catId
          );
          totalPoints += (record?.avg_norm_point || 0) * count;
        });
        avgPoints[`${cls}_${wk}`] = totalCount ? totalPoints / totalCount : 0;
      });
    });

    // Calculate averages for text display - SETELAH avgPoints didefinisikan
    const averages = {};
    Object.entries(pivot).forEach(([className, weekData]) => {
      let totalExtraction = 0;
      let totalPoints = 0;
      let weekCount = 0;

      Object.entries(weekData).forEach(([week, categories]) => {
        let weekTotal = 0;
        let weekPoints = avgPoints[`${className}_${week}`] || 0;
        Object.values(categories).forEach((count) => {
          weekTotal += count;
        });
        totalExtraction += weekTotal;
        totalPoints += weekPoints;
        weekCount++;
      });

      averages[className] = {
        extraction: totalExtraction / weekCount,
        points: totalPoints / weekCount,
      };
    });

    const averagesTextByClass = {};
    Object.entries(pivot).forEach(([className, weekData]) => {
      const classAverages = {}; // Store averages per category for this class
      categoryIds.forEach((catId, ci) => {
        const catName = categoryNames[ci];
        let totalCount = 0;
        let totalPoint = 0;
        let weekCount = 0;

        weeks.forEach((wk) => {
          const count = weekData[wk][catId];
          totalCount += count;
          const record = data.find(
            (r) =>
              r.class_name === className &&
              r.week_label === wk &&
              r.category_id[0] === catId
          );
          if (record?.avg_norm_point) {
            totalPoint += parseFloat(record.avg_norm_point);
            weekCount++;
          }
        });

        classAverages[catName] = {
          count: totalCount / weeks.length,
          point: weekCount ? totalPoint / weekCount : 0,
        };
      });

      // Format text for this class's averages
      averagesTextByClass[className] = Object.entries(classAverages).map(
        ([catName, avg]) =>
          `${catName}: Rata-rata Ekstraksi: ${avg.count.toFixed(
            1
          )} | Point: ${avg.point.toFixed(2)}`
      );
    });

    // Layout settings after averagesTextByClass is defined
    const MAX_COLS = 3;
    const cols = Math.min(MAX_COLS, classes.length);
    const rows = Math.ceil(classes.length / cols);
    const perRowHeight = 300;
    const legendHeight = 80;
    const textLineHeight = 16;
    const bottomPadding = -100; // Changed to positive value

    // Now we can safely use averagesTextByClass
    const maxAverageLines = Math.max(
      ...Object.values(averagesTextByClass).map((texts) => texts.length)
    );

    // Sesuaikan perhitungan tinggi total container
    const totalHeight =
      rows * perRowHeight +
      legendHeight +
      maxAverageLines * textLineHeight +
      bottomPadding;

    chartDom.style.height = `${totalHeight}px`;

    // Sesuaikan grid height - kurangi sedikit untuk memberi ruang text
    const grids = classes.map((_, idx) => ({
      left: `${(idx % cols) * (100 / cols + 1) + 4}%`,
      top: `${Math.floor(idx / cols) * (100 / rows + 1) + legendHeight}px`,
      width: `${100 / cols - 6}%`,
      height: `${perRowHeight * 0.7}px`, // kurangi ratio height
      containLabel: true,
    }));

    // Add titlePerGrid definition
    const titlePerGrid = classes.map((cls, idx) => ({
      text: cls,
      textAlign: "center",
      left: `${(idx % cols) * (100 / cols + 1) + 4 + (100 / cols - 6) / 2}%`,
      top: `${Math.floor(idx / cols) * (100 / rows + 1) + legendHeight - 20}px`,
      textStyle: {
        fontSize: 12,
        fontWeight: "bold",
      },
    }));

    const baseColors = [
      "#5470C6", // Biru
      "#91CC75", // Hijau
      "#EE6666", // Merah
      "#73C0DE", // Biru Muda
      "#3BA272", // Hijau Tua
      "#FC8452", // Oranye
      "#9A60B4", // Ungu
      "#EA7CCC", // Pink
    ];

    function generateColorVariants(baseColor) {
      const color = echarts.color.lift(baseColor, 0);
      return [
        echarts.color.lift(color, 0.2),
        color,
        echarts.color.lift(color, -0.2),
      ];
    }

    // Generate series
    const series = [];
    classes.forEach((cls, ci) => {
      categoryIds.forEach((catId, ci2) => {
        const catName = categoryNames[ci2];
        const baseColor = baseColors[ci2 % baseColors.length];
        const variants = generateColorVariants(baseColor);

        series.push({
          name: `${catName} (Jumlah)`,
          type: "bar",
          stack: `kelas_${ci}`,
          xAxisIndex: ci,
          yAxisIndex: ci * 2,
          data: weeks.map((wk) => pivot[cls][wk][catId]),
          itemStyle: { color: variants[1] },
          emphasis: { focus: "series" },
        });

        series.push({
          name: `${catName} (Point)`,
          type: "line",
          xAxisIndex: ci,
          yAxisIndex: ci * 2 + 1,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: {
            width: 2,
            type: "solid",
          },
          itemStyle: { color: variants[2] },
          data: weeks.map((wk) => {
            const record = data.find(
              (r) =>
                r.class_name === cls &&
                r.week_label === wk &&
                r.category_id[0] === catId
            );
            return record?.avg_norm_point?.toFixed(2) || 0;
          }),
        });
      });
    });

    const option = {
      title: [
        {},
        // Class titles dan averages text
        ...classes
          .map((cls, idx) => [
            // Class title
            {
              text: cls,
              textAlign: "center",
              left: `${
                (idx % cols) * (100 / cols + 1) + 4 + (100 / cols - 6) / 2
              }%`,
              top: `${
                Math.floor(idx / cols) * (100 / rows + 1) + legendHeight - 20
              }px`,
              textStyle: {
                fontSize: 12,
                fontWeight: "bold",
              },
            },
            // Averages text untuk setiap kelas
            ...averagesTextByClass[cls].map((text, textIdx) => ({
              text: text,
              textAlign: "left",
              left: `${(idx % cols) * (100 / cols + 1) + 4}%`,
              // Posisikan di bawah grid
              top: `${
                Math.floor(idx / cols) * (100 / rows + 1) +
                legendHeight +
                perRowHeight * 0.8 +
                textIdx * 16
              }px`,
              textStyle: {
                fontSize: 11,
                fontWeight: "normal",
              },
            })),
          ])
          .flat(),
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
        top: 20,
        padding: [5, 50],
        height: legendHeight - 50,
        textStyle: { fontSize: 11 },
        width: "90%",
        left: "center",
        formatter: (name) => name.replace(/\s-\s[^(]+/, ""),
      },
      grid: grids,
      xAxis: classes.map((_, ci) => ({
        type: "category",
        gridIndex: ci,
        data: xWeeks,
        axisLabel: {
          rotate: 45,
          fontSize: 10,
          interval: 0,
          margin: 14,
        },
        nameGap: 35,
      })),
      yAxis: classes
        .map((_, ci) => [
          {
            type: "value",
            gridIndex: ci,
            name: "Jumlah Ekstraksi",
            nameLocation: "middle",
            nameGap: 45,
            position: "left",
            axisLabel: { fontSize: 10 },
            splitLine: { show: false },
          },
          {
            type: "value",
            gridIndex: ci,
            name: "Point",
            nameLocation: "middle",
            nameGap: 50,
            position: "right",
            offset: 0,
            min: 0,
            max: 1,
            axisLabel: {
              fontSize: 10,
              formatter: (value) => value.toFixed(2),
            },
            splitLine: { show: false },
          },
        ])
        .flat(),
      series: series,
      // Adjust visual settings
      backgroundColor: "#fff",
      animation: true,
      animationDuration: 500,
    };

    chartDom.style.height = `${
      rows * perRowHeight +
      legendHeight +
      Math.max(...Object.values(averagesTextByClass).map((arr) => arr.length)) *
        16
    }px`;

    // Render chart
    if (this.echarts.chart4) this.echarts.chart4.dispose();
    const chart = echarts.init(chartDom);

    chart.setOption(option);
    this.echarts.chart4 = chart;
  }

  renderExtractionSubcategoryTrendByClass() {
    const chartDom = document.getElementById(
      "chart_extraction_subcategory_class"
    );
    if (!chartDom) return;

    const data = this.state.extractionBySubcategoryClass;
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

    const weeks = Array.from(new Set(data.map((r) => r.week_label))).sort(
      (a, b) => parseDate(a) - parseDate(b)
    );
    const xWeeks = weeks.map((_, i) => `W${i + 1}`);
    const classes = Array.from(new Set(data.map((r) => r.class_name))).sort();

    // Add this code to extract subcategory info
    const subPairs = Array.from(
      new Map(
        data.map((r) => [r.subcategory_id[0], r.subcategory_id[1]])
      ).entries()
    ).sort((a, b) => a[0] - b[0]);
    const subIds = subPairs.map((p) => p[0]);
    const subNames = subPairs.map((p) => p[1]);

    // Rest of the code remains the same...
    const pivot = {};
    classes.forEach((cls) => {
      pivot[cls] = {};
      weeks.forEach((wk) => {
        pivot[cls][wk] = {};
        subIds.forEach((sid) => {
          pivot[cls][wk][sid] = {
            count: 0,
            point: 0,
          };
        });
      });
    });
    classes.forEach((cls) => {
      pivot[cls] = {};
      weeks.forEach((wk) => {
        pivot[cls][wk] = {};
        subIds.forEach((sid) => {
          pivot[cls][wk][sid] = {
            count: 0,
            point: 0,
          };
        });
      });
    });

    data.forEach((r) => {
      const cls = r.class_name;
      const wk = r.week_label;
      const sid = r.subcategory_id[0];
      pivot[cls][wk][sid] = {
        count: r.extraction_count,
        point: r.avg_norm_point || 0,
      };
    });

    // Calculate averages for text display
    const averagesTextByClass = {};
    Object.entries(pivot).forEach(([className, weekData]) => {
      const classAverages = {};
      subIds.forEach((sid, si) => {
        const subName = subNames[si];
        let totalCount = 0;
        let totalPoint = 0;
        let weekCount = 0;

        weeks.forEach((wk) => {
          const record = weekData[wk][sid];
          totalCount += record.count;
          if (record.point) {
            totalPoint += record.point;
            weekCount++;
          }
        });

        classAverages[subName] = {
          count: totalCount / weeks.length,
          point: weekCount ? totalPoint / weekCount : 0,
        };
      });

      averagesTextByClass[className] = Object.entries(classAverages).map(
        ([subName, avg]) =>
          `${subName}: Rata-rata Ekstraksi: ${avg.count.toFixed(
            1
          )} | Point: ${avg.point.toFixed(2)}`
      );
    });

    // Layout settings
    const MAX_COLS = 2;
    const cols = Math.min(MAX_COLS, classes.length);
    const rows = Math.ceil(classes.length / cols);
    const perRowHeight = 250; // kurangi dari 300 ke 250
    const legendHeight = 80;
    const textLineHeight = 16;
    const bottomPadding = -35; // kurangi dari 20 ke 10

    const maxAverageLines = Math.max(
      ...Object.values(averagesTextByClass).map((texts) => texts.length)
    );

    // Set container height
    const totalHeight =
      rows * perRowHeight +
      legendHeight +
      maxAverageLines * textLineHeight +
      bottomPadding;

    chartDom.style.height = `${totalHeight}px`;

    // Grid configuration - sesuaikan height ratio menjadi lebih besar
    const grids = classes.map((_, idx) => ({
      left: `${(idx % cols) * (100 / cols + 1) + 4}%`,
      top: `${Math.floor(idx / cols) * (100 / rows + 1) + legendHeight}px`,
      width: `${100 / cols - 6}%`,
      height: `${perRowHeight * 0.75}px`, // naikkan dari 0.7 ke 0.75
      containLabel: true,
    }));

    const baseColors = [
      "#5470C6", // Biru
      "#91CC75", // Hijau
      "#EE6666", // Merah
      "#73C0DE", // Biru Muda
      "#3BA272", // Hijau Tua
      "#FC8452", // Oranye
      "#9A60B4", // Ungu
      "#EA7CCC", // Pink
    ];

    // Fungsi untuk menghasilkan variasi warna (light, normal, dark)
    function generateColorVariants(baseColor) {
      const color = echarts.color.lift(baseColor, 0); // Convert to RGB
      return [
        echarts.color.lift(color, 0.2), // Light version
        color, // Normal version
        echarts.color.lift(color, -0.2), // Dark version
      ];
    }

    // Generate series
    const series = [];
    classes.forEach((cls, ci) => {
      subIds.forEach((sid, si) => {
        const subName = subNames[si];
        const baseColor = baseColors[si % baseColors.length];
        const variants = generateColorVariants(baseColor);

        series.push({
          name: `${subName} (Jumlah)`,
          type: "bar",
          stack: `kelas_${ci}`,
          xAxisIndex: ci,
          yAxisIndex: ci * 2,
          data: weeks.map((wk) => pivot[cls][wk][sid].count),
          itemStyle: { color: variants[1] },
          emphasis: { focus: "series" },
        });

        series.push({
          name: `${subName} (Point)`,
          type: "line",
          xAxisIndex: ci,
          yAxisIndex: ci * 2 + 1,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 2, type: "solid" },
          itemStyle: { color: variants[2] },
          data: weeks.map((wk) => pivot[cls][wk][sid].point.toFixed(2)),
        });
      });
    });

    // Chart options
    const option = {
      title: [
        {},
        ...classes
          .map((cls, idx) => [
            {
              text: cls,
              textAlign: "center",
              left: `${
                (idx % cols) * (100 / cols + 1) + 4 + (100 / cols - 6) / 2
              }%`,
              top: `${
                Math.floor(idx / cols) * (100 / rows + 1) + legendHeight - 20
              }px`,
              textStyle: { fontSize: 12, fontWeight: "bold" },
            },
            ...averagesTextByClass[cls].map((text, textIdx) => ({
              text: text,
              textAlign: "left",
              left: `${(idx % cols) * (100 / cols + 1) + 4}%`,
              top: `${
                Math.floor(idx / cols) * (100 / rows + 1) +
                legendHeight +
                perRowHeight * 0.8 +
                textIdx * 16
              }px`,
              textStyle: { fontSize: 11, fontWeight: "normal" },
            })),
          ])
          .flat(),
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
        top: 20,
        padding: [5, 50],
        height: legendHeight - 50,
        textStyle: { fontSize: 11 },
        width: "90%",
        left: "center",
        formatter: (name) => name.replace(/\s-\s[^(]+/, ""),
      },
      grid: grids,
      xAxis: classes.map((_, ci) => ({
        type: "category",
        gridIndex: ci,
        data: xWeeks,
        axisLabel: {
          rotate: 45,
          fontSize: 10,
          interval: 0,
          margin: 14,
        },
        nameGap: 35,
      })),
      yAxis: classes
        .map((_, ci) => [
          {
            type: "value",
            gridIndex: ci,
            name: "Jumlah Ekstraksi",
            nameLocation: "middle",
            nameGap: 45,
            position: "left",
            axisLabel: { fontSize: 10 },
            splitLine: { show: false },
          },
          {
            type: "value",
            gridIndex: ci,
            name: "Point",
            nameLocation: "middle",
            nameGap: 50,
            position: "right",
            offset: 0,
            min: 0,
            max: 1,
            axisLabel: {
              fontSize: 10,
              formatter: (value) => value.toFixed(2),
            },
            splitLine: { show: false },
          },
        ])
        .flat(),
      series: series,
      backgroundColor: "#fff",
      animation: true,
      animationDuration: 500,
    };

    // Render chart
    if (this.echarts.chart5) this.echarts.chart5.dispose();
    const chart = echarts.init(chartDom);
    chart.setOption(option);
    this.echarts.chart5 = chart;
  }

  renderExtractionLabelFreqHeatmapClass() {
    const chartDom = document.getElementById("heatmapLabelFreqClass");
    if (!chartDom) return;

    const data = this.state.extractionByLabel;
    if (!data || data.length === 0) {
      chartDom.innerHTML =
        "<p style='text-align:center'>Data tidak tersedia</p>";
      return;
    }

    // --- 1) Parse dan urutkan minggu
    const parseDate = (s) => {
      const [d, m, y] = s.split(" ");
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
      return new Date(+y, monthMap[m], +d);
    };
    const weekLabels = Array.from(new Set(data.map((d) => d.week_label))).sort(
      (a, b) => parseDate(a) - parseDate(b)
    );
    const weekIndexLabels = weekLabels.map((_, i) => `W${i + 1}`);

    // --- 2) Kelas dan label info
    const classList = Array.from(new Set(data.map((d) => d.class_name))).sort();

    // --- 3) Label info
    const labelMap = new Map();
    data.forEach((r) => {
      const [labelId, labelName] = r.label_id;
      const [catId, catName] = r.category_id;
      const subName = r.subcategory_id?.[1] || "";
      const prefix = subName ? `[${catName}-${subName}]` : `[${catName}]`;
      const formatted = `${prefix} ${labelName}`;
      if (!labelMap.has(labelId)) {
        labelMap.set(labelId, { labelId, categoryId: catId, formatted });
      }
    });
    const labelInfos = Array.from(labelMap.values()).sort((a, b) =>
      b.categoryId !== a.categoryId
        ? b.categoryId - a.categoryId
        : b.labelId - a.labelId
    );
    const yLabels = labelInfos.map((info) => info.formatted);
    const labelIndexMap = new Map(
      labelInfos.map((info, i) => [info.labelId, i])
    );

    // --- 4) Hitung tinggi dinamis
    const rowHeight = 22; // tinggi per label row
    const basePadding = 80; // untuk legend + title
    const perGridHeight = Math.max(200, yLabels.length * rowHeight);
    chartDom.style.height = `${
      classList.length * perGridHeight + basePadding
    }px`;

    const grids = [],
      xAxes = [],
      yAxes = [],
      series = [],
      titles = [];

    // --- 5) Bangun heatmap per kelas
    classList.forEach((cls, idx) => {
      const heatmapData = [];

      data.forEach((r) => {
        if (r.class_name !== cls) return;
        const wl = r.week_label;
        const [labelId] = r.label_id;
        const x = weekLabels.indexOf(wl);
        const y = labelIndexMap.get(labelId);
        if (x !== -1 && y !== undefined) {
          heatmapData.push([x, y, r.extraction_count]);
        }
      });

      const gridTop = basePadding + idx * perGridHeight;
      grids.push({
        top: `${gridTop}px`,
        height: `${perGridHeight - 40}px`,
        left: 100,
        right: 60,
        containLabel: true,
      });

      xAxes.push({
        type: "category",
        data: weekIndexLabels,
        gridIndex: idx,
        name: "Minggu",
        axisLabel: { interval: 0, fontSize: 9 },
        splitArea: { show: true },
      });

      yAxes.push({
        type: "category",
        data: yLabels,
        gridIndex: idx,
        name: "",
        splitArea: { show: true },
        axisLabel: { fontSize: 10 },
      });

      series.push({
        name: cls,
        type: "heatmap",
        data: heatmapData,
        xAxisIndex: idx,
        yAxisIndex: idx,
        label: {
          show: true,
          fontSize: 9,
          formatter: (param) => param.value[2],
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0,0,0,0.5)",
          },
        },
      });

      titles.push({
        text: `Kelas ${cls}`,
        top: `${gridTop - 22}px`,
        left: "center",
        textStyle: { fontWeight: "bold", fontSize: 13 },
      });
    });

    if (this.echarts.heatmapLabelFreqClass) {
      this.echarts.heatmapLabelFreqClass.dispose();
    }

    const chart = echarts.init(chartDom);
    chart.setOption({
      title: [{}, ...titles],
      tooltip: {
        position: "top",
        formatter: (params) => {
          const [x, y, val] = params.data;
          return `${yLabels[y]}<br/>${weekIndexLabels[x]} (${weekLabels[x]}): ${val}`;
        },
      },
      visualMap: {
        min: 0,
        max: Math.max(...data.map((d) => d.extraction_count)),
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 5,
      },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series: series,
    });

    this.echarts.heatmapLabelFreqClass = chart;
  }

  renderExtractionLabelPointHeatmapClass() {
    const chartDom = document.getElementById("heatmapLabelPointClass");
    if (!chartDom) return;

    const allData = this.state.normByLabel;
    if (!allData || allData.length === 0) {
      chartDom.innerHTML =
        "<p style='text-align:center'>Data tidak tersedia</p>";
      return;
    }

    // 1) Urutkan minggu
    const weekLabels = Array.from(
      new Set(allData.map((d) => d.week_label))
    ).sort((a, b) => {
      const parse = (s) => {
        const [d, m, y] = s.split(" ");
        const mm = {
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
        return new Date(+y, mm[m], +d);
      };
      return parse(a) - parse(b);
    });
    const weekIndexLabels = weekLabels.map((_, i) => `W${i + 1}`);

    // 2) Kelas dan label info
    const classMap = new Map();
    allData.forEach((d) => {
      const [id, name] = d.class_id;
      if (!classMap.has(id)) {
        classMap.set(id, name);
      }
    });
    const classes = Array.from(classMap.entries())
      .sort((a, b) => b[0] - a[0]) // urutkan berdasarkan class_id
      .map((entry) => entry[1]); // ambil hanya nama kelas
    const labelMap = new Map();
    allData.forEach((r) => {
      const [labelId, labelName] = r.label_id;
      const [catId, catName] = r.category_id;
      const subName = r.subcategory_id?.[1] || "";
      const prefix = subName ? `[${catName}-${subName}]` : `[${catName}]`;
      const formatted = `${prefix} ${labelName}`;
      if (!labelMap.has(labelId)) {
        labelMap.set(labelId, { labelId, categoryId: catId, formatted });
      }
    });
    const labelInfos = Array.from(labelMap.values()).sort((a, b) =>
      b.categoryId !== a.categoryId
        ? b.categoryId - a.categoryId
        : b.labelId - a.labelId
    );
    const yLabels = labelInfos.map((info) => info.formatted);
    const labelIndexMap = new Map(
      labelInfos.map((info, i) => [info.labelId, i])
    );

    // 3) Hitung tinggi
    const rowHeight = 22; // tinggi per label row
    const basePadding = 80; // untuk legend + title
    const perGridHeight = Math.max(200, yLabels.length * rowHeight);
    chartDom.style.height = `${classes.length * perGridHeight + basePadding}px`;

    const grids = [],
      xAxes = [],
      yAxes = [],
      series = [],
      titles = [];

    // 4) Bangun heatmap per kelas
    classes.forEach((cls, idx) => {
      const heatmapData = [];

      allData.forEach((r) => {
        if (r.class_name !== cls) return;
        const wl = r.week_label;
        const [labelId] = r.label_id;
        const x = weekLabels.indexOf(wl);
        const y = labelIndexMap.get(labelId);
        if (x !== -1 && y !== undefined) {
          heatmapData.push([x, y, parseFloat(r.avg_norm_point)]);
        }
      });

      const gridTop = basePadding + idx * perGridHeight;
      grids.push({
        top: `${gridTop}px`,
        height: `${perGridHeight - 40}px`,
        left: 100,
        right: 60,
        containLabel: true,
      });

      xAxes.push({
        type: "category",
        data: weekIndexLabels,
        gridIndex: idx,
        name: "Minggu",
        axisLabel: { interval: 0, fontSize: 9 },
        splitArea: { show: true },
      });

      yAxes.push({
        type: "category",
        data: yLabels,
        gridIndex: idx,
        name: "",
        splitArea: { show: true },
        axisLabel: { fontSize: 10 },
      });

      series.push({
        name: cls,
        type: "heatmap",
        data: heatmapData,
        xAxisIndex: idx,
        yAxisIndex: idx,
        label: {
          show: true,
          fontSize: 9,
          formatter: (param) => param.value[2].toFixed(2),
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0,0,0,0.5)",
          },
        },
      });

      titles.push({
        text: `Kelas ${cls}`,
        top: `${gridTop - 22}px`,
        left: "center",
        textStyle: { fontWeight: "bold", fontSize: 13 },
      });
    });

    const chart = echarts.init(chartDom);
    chart.setOption({
      title: [{}, ...titles],
      tooltip: {
        position: "top",
        formatter: (params) => {
          const [x, y, val] = params.data;
          return `${yLabels[y]}<br/>${weekIndexLabels[x]}: ${val.toFixed(2)}`;
        },
      },
      visualMap: {
        min: 0,
        max: 1,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 5,
        inRange: { color: ["#f7fbff", "#08306b"] },
      },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series: series,
    });

    this.echarts.heatmapLabelPointClass = chart;
  }

  renderExtractionLabelOverallRadarChartClass() {
    const chartDom = document.getElementById("labelPointRadarClass");
    if (!chartDom) return;

    const chart = echarts.init(chartDom);
    const allData = this.state.normByLabel;

    if (!allData || allData.length === 0) {
      chart.clear();
      return;
    }

    // 1. Ambil info label unik
    const labelMap = new Map();
    allData.forEach((r) => {
      const [id, name] = r.label_id;
      const cat = r.category_id?.[1] || "";
      const sub = r.subcategory_id?.[1] || "";
      const prefix = sub ? `[${cat}-${sub}]` : `[${cat}]`;
      const full = `${prefix} ${name}`;
      if (!labelMap.has(id)) {
        labelMap.set(id, { labelId: id, formatted: full });
      }
    });

    const labelInfos = Array.from(labelMap.values()).sort((a, b) => {
      if (a.categoryId !== b.categoryId) return b.categoryId - a.categoryId;
      return b.labelId - a.labelId;
    });

    const labelIndexMap = new Map(labelInfos.map((l, i) => [l.labelId, i]));

    const radarIndicators = labelInfos.map((info) => ({
      name: wrapLabel(info.formatted, 25), // ⬅️
      max: 1,
    }));

    // 2. Hitung avg per label per class
    const classMap = new Map();
    allData.forEach((r) => {
      const cls = r.class_name;
      const labId = r.label_id[0];
      const val = parseFloat(r.avg_norm_point);
      if (!classMap.has(cls)) {
        classMap.set(cls, {
          name: cls,
          sum: Array(labelInfos.length).fill(0),
          count: Array(labelInfos.length).fill(0),
        });
      }
      const group = classMap.get(cls);
      const i = labelIndexMap.get(labId);
      group.sum[i] += val;
      group.count[i] += 1;
    });

    const seriesData = Array.from(classMap.values()).map((clsObj) => {
      const values = clsObj.sum.map(
        (s, i) => +(s / (clsObj.count[i] || 1)).toFixed(2)
      );
      return {
        name: clsObj.name,
        value: values,
      };
    });
    function wrapLabel(name, maxLen = 25) {
      const words = name.split(" ");
      const lines = [];
      let cur = "";

      for (const w of words) {
        // kalau ditambah w melebihi batas, pindah baris
        if ((cur + " " + w).length > maxLen) {
          if (cur) lines.push(cur);
          cur = w;
        } else {
          cur += (cur ? " " : "") + w;
        }
      }
      if (cur) lines.push(cur);
      return lines.join("\n");
    }

    chart.setOption({
      tooltip: {
        trigger: "item",
        formatter: (param) => {
          const values = param.value;
          const list = radarIndicators.map((r, i) => ({
            label: r.name,
            val: values[i],
          }));
          list.sort((a, b) => b.val - a.val);
          return (
            `<strong>${param.name}</strong><br/>` +
            list.map((i) => `${i.label}: ${i.val}`).join("<br/>")
          );
        },
      },
      legend: {
        top: 20,
        type: "scroll",
      },
      radar: {
        indicator: radarIndicators,
        shape: "circle",
        splitNumber: 5,
        axisName: {
          fontSize: 10,
          lineHeight: 12,
        },
        axisNameGap: 12, // tambah jarak sedikit
      },
      series: [
        {
          type: "radar",
          data: seriesData,
          symbolSize: 4,
          areaStyle: { opacity: 0.2 },
          lineStyle: { width: 2 },
        },
      ],
    });

    this.echarts.labelPointRadarClass = chart;
  }
}

LogbookClassAnalytics.props = {
  projectId: { type: Number },
};


LogbookClassAnalytics.template = "jtk_logbook_analytics.LogbookClassAnalytics";
registry
  .category("actions")
  .add("jtk_logbook_analytics.logbook_class_analytics", LogbookClassAnalytics);
