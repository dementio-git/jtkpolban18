import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";
import * as echarts from "echarts";
import { useService } from "@web/core/utils/hooks";
// Tabulator sudah ter-load via assets sebagai global Tabulator

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

export class LogbookStudentAnalytics extends Component {
  setup() {
    this.orm = useService("orm");
    this.echarts = {};
    this.state = useState({
      students: [],
      components: {},
      normData: [],
      studentList: [],
      categories: [],
      statsData: [],
      projectCourseId: null, // Tambah state baru
      extractionStatsData: [], // Tambah state baru
      selectedStudentId: null,
      studentWeeklyStats: [],
      studentWeeklyActivity: [],
    });
    this.table = null;
    this.statsTable = null;
    this.extractionStatsTable = null;

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
      await Promise.all([
        this.fetchClusteringData(this.state.projectCourseId),
        this.fetchNormalizationData(this.state.projectCourseId),
        this.fetchStatsData(this.state.projectCourseId),
        this.fetchExtractionStatsData(this.state.projectCourseId), // Tambah fungsi fetch baru
      ]);

      this.processDataStructures();
    });

    onMounted(() => {
      setTimeout(() => {
        this.renderChart();
        this.renderTable();
        this.renderStatsTable();
        this.renderExtractionStatsTable(); // Tambah render table baru
      }, 0);
    });
  }

  async fetchClusteringData(projectCourseId) {
    const res = await rpc("/logbook/clustering/label", {
      project_course_id: projectCourseId,
    });
    this.state.students = res.students || [];
    this.state.components = res.components_info || {};
  }

  async fetchNormalizationData(projectCourseId) {
    this.state.normData = await this.orm.searchRead(
      "logbook.extraction.student.label.norm",
      [["project_course_id", "=", projectCourseId]],
      [
        "student_id",
        "label_id",
        "avg_norm_point",
        "category_id",
        "subcategory_id",
        "class_name", // Add this line
      ]
    );
  }

  async fetchStatsData(projectCourseId) {
    this.state.statsData = await this.orm.searchRead(
      "logbook.descriptive.stats.student",
      [["project_course_id", "=", projectCourseId]],
      [
        "student_id",
        "student_name",
        "class_name",
        "total_logbooks",
        "avg_logbooks_per_week",
        "std_dev_logbooks",
        "active_weeks",
        "participation_rate",
      ]
    );
  }

  async fetchExtractionStatsData(projectCourseId) {
    this.state.extractionStatsData = await this.orm.searchRead(
      "logbook.extraction.descriptive.stats.student",
      [["project_course_id", "=", projectCourseId]],
      [
        "student_id",
        "student_name",
        "class_name",
        "total_extraction",
        "avg_extraction_per_logbook",
        "std_extraction_per_logbook",
        "avg_extraction_per_week",
        "std_extraction_per_week",
      ]
    );
  }
  async onStudentChange(event) {
    const studentId = parseInt(event.target.value);
    this.state.selectedStudentId = studentId;

    if (studentId) {
      await Promise.all([
        this.loadStudentWeeklyStats(studentId),
        this.loadStudentWeeklyActivity(studentId),
        this.loadWeeklySimilarity(studentId), // Tambahkan ini
      ]);
      this.renderStudentCharts();
    }
  }

  async loadWeeklySimilarity(studentId) {
    const projectCourseId = getRecordIdFromPath();
    const result = await rpc("/logbook/similarity/weekly", {
      student_id: studentId,
      project_course_id: projectCourseId,
    });
    this.state.similarityData = result;
  }

  async loadStudentWeeklyStats(studentId) {
    const projectCourseId = getRecordIdFromPath();
    this.state.studentWeeklyStats = await this.orm.searchRead(
      "logbook.weekly.stats.student",
      [
        ["project_course_id", "=", projectCourseId],
        ["student_id", "=", studentId],
      ],
      ["week_label", "week_start_date", "week_end_date", "total_logbooks"]
    );
  }

  async loadStudentWeeklyActivity(studentId) {
    const projectCourseId = getRecordIdFromPath();
    this.state.studentWeeklyActivity = await this.orm.searchRead(
      "logbook.extraction.weekly.student",
      [
        ["project_course_id", "=", projectCourseId],
        ["student_id", "=", studentId],
      ],
      ["week_label", "week_start_date", "week_end_date", "extraction_count"]
    );
  }

  renderStudentCharts() {
    this.renderStudentWeeklyActivityChart();
    this.renderSimilarityHeatmap(); // Tambahkan ini
  }

  processDataStructures() {
    const studentMap = {};
    const categoryMap = new Map();

    for (const row of this.state.normData) {
      const [sid, sname] = row.student_id;
      const [lid, lname] = row.label_id;
      const [cid, cname] = row.category_id;
      const subid = row.subcategory_id?.[0] ?? null;
      const subname = row.subcategory_id?.[1] ?? "-";
      const point = row.avg_norm_point;
      const className = row.class_name || "-";

      this.updateStudentMap(studentMap, sid, sname, lid, point, className);
      this.updateCategoryMap(
        categoryMap,
        cid,
        cname,
        subid,
        subname,
        lid,
        lname
      );
    }

    this.state.studentList = Object.values(studentMap);
    this.state.categories = Array.from(categoryMap.values()).map((cat) => ({
      ...cat,
      subcategories: Array.from(cat.subcategories.values()),
    }));
  }
  updateStudentMap(studentMap, sid, sname, lid, point, className) {
    if (!studentMap[sid]) {
      studentMap[sid] = {
        student_id: sid,
        student_name: sname,
        class_name: className,
        scores: {},
      };
    }
    studentMap[sid].scores[`label_${lid}`] = point;
  }

  updateCategoryMap(categoryMap, cid, cname, subid, subname, lid, lname) {
    if (!categoryMap.has(cid)) {
      categoryMap.set(cid, {
        id: cid,
        name: cname,
        subcategories: new Map(),
      });
    }
    const cat = categoryMap.get(cid);
    if (!cat.subcategories.has(subid)) {
      cat.subcategories.set(subid, {
        id: subid,
        name: subname,
        labels: [],
      });
    }
    const sub = cat.subcategories.get(subid);
    if (!sub.labels.find((l) => l.id === lid)) {
      sub.labels.push({ id: lid, name: lname });
    }
  }

  goToStudent(studentId) {
    window.location.href = `/web#model=student.student&id=${studentId}&view_type=form`;
  }

  renderChart() {
    const container = document.getElementById("chart");
    if (!container) return;
    const chart = echarts.init(container);

    // Buat series: setiap mahasiswa dipetakan sebagai series terpisah
    const series = this.state.students.map((s) => ({
      name: s.student_name,
      type: "scatter",
      data: [
        {
          value: [s.x, s.y],
          cluster: s.cluster,
        },
      ],
      itemStyle: {
        color: this.getColor(s.cluster),
      },
    }));

    chart.setOption({
      grid: {
        left: "5%", // Atur margin kiri
        right: "32%", // Berikan ruang untuk legenda di kanan
        top: "10%",
        bottom: "10%",
        containLabel: true,
      },
      tooltip: {
        trigger: "item",
        formatter: function (params) {
          return (
            `Mahasiswa: ${params.seriesName}<br/>` +
            `Cluster: ${params.data.cluster}<br/>` +
            `X: ${params.data.value[0].toFixed(2)}<br/>` +
            `Y: ${params.data.value[1].toFixed(2)}`
          );
        },
      },
      xAxis: {
        name: this.state.components.x_axis_name || "X-Axis",
        scale: true,
        nameLocation: "center", // letaknya di tengah sumbu
        nameGap: 25, // jarak dari sumbu ke label
        nameTextStyle: {
          fontSize: 12, // perkecil ukuran font
        },
      },
      yAxis: {
        name: this.state.components.y_axis_name || "Y-Axis",
        scale: true,
        nameLocation: "center", // letaknya di tengah sumbu Y
        nameGap: 35, // sedikit lebih jauh agar tidak bertabrakan dengan angka
        nameRotate: 90, // rotasi agar teks vertikal
        nameTextStyle: {
          fontSize: 12, // ukuran teks lebih kecil
        },
      },
      legend: {
        type: "scroll",
        orient: "vertical",
        right: 10,
        top: 60,
        // Gunakan legend dari backend: daftar nama mahasiswa (urutan berdasarkan student_id)
        data: this.state.components.legend || [],
      },
      series: series,
    });
  }

  getColor(cluster) {
    const colors = ["#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE"];
    return colors[cluster % colors.length];
  }

  renderTable() {
    const el = document.getElementById("tabulator-table");
    if (!el || !this.state.categories.length) return;

    // destroy instance lama
    if (this.table) {
      this.table.destroy();
      el.innerHTML = "";
    }

    const sortedCategories = [...this.state.categories].sort(
      (a, b) => a.id - b.id
    );

    const columns = [
      {
        title: "Nama Mahasiswa",
        field: "student_name",
        frozen: true,
        headerSort: true,
        headerFilter: "input",
        headerFilterPlaceholder: "🔍 Cari…",
      },
      {
        title: "Kelas",
        field: "class_name",
        frozen: true,
        headerSort: true,
        headerFilter: "input",
      },
      ...sortedCategories.map((cat) => ({
        title: cat.name,
        columns: cat.subcategories
          .sort((a, b) => a.id - b.id)
          .map((sub) => ({
            title: sub.name,
            columns: sub.labels
              .sort((a, b) => a.id - b.id)
              .map((label) => ({
                title: label.name,
                field: `label_${label.id}`,
                headerSort: true,
                headerHozAlign: "center",
                hozAlign: "center",
                formatter: function (cell) {
                  const v = cell.getValue();
                  if (v == null) return "-";
                  return parseFloat(v).toFixed(2);
                },
              })),
          })),
      })),
      {
        title: "Total",
        field: "total",
        headerSort: true,
        frozen: true,
        headerHozAlign: "center",
        hozAlign: "center",
        formatter: function (cell) {
          const v = cell.getValue();
          if (v == null) return "-";
          return parseFloat(v).toFixed(2);
        },
      },
    ]; // Build data rows
    const data = this.state.studentList.map((s) => {
      const row = {
        student_name: s.student_name,
        class_name: s.class_name,
      };

      let total = 0;
      Object.entries(s.scores).forEach(([key, val]) => {
        const value = val != null ? parseFloat(val) : null;
        row[key] = value;
        if (value != null) {
          total += value;
        }
      });
      row.total = total;
      return row;
    }); // Calculate average row
    const averageRow = {
      student_name: "Rata-rata",
      class_name: "",
      total: data.reduce((sum, row) => sum + (row.total || 0), 0) / data.length,
    };

    // Calculate averages for each label column
    this.state.categories.forEach((category) => {
      category.subcategories.forEach((sub) => {
        sub.labels.forEach((label) => {
          const fieldName = `label_${label.id}`;
          const values = data
            .map((row) => row[fieldName])
            .filter((val) => val != null);

          if (values.length > 0) {
            averageRow[fieldName] =
              values.reduce((sum, val) => sum + val, 0) / values.length;
          } else {
            averageRow[fieldName] = null;
          }
        });
      });
    });

    // Add average row at the top
    const tableData = [averageRow, ...data];

    this.table = new Tabulator(el, {
      data: tableData,
      columns,
      layout: "fitDataTable",
      responsiveLayout: false,
      height: "800px",
      rowHeight: 28,
      columnVertAlign: "middle",
      headerVertAlign: "middle",
      pagination: true,
      paginationSize: 100,
      paginationSizeSelector: [10, 25, 50, 100],
      paginationCounter: "rows",
      frozenRows: 1,
      columnDefaults: {
        resizable: true,
      },
    });
  }

  renderStatsTable() {
    const el = document.getElementById("stats-table");
    if (!el || !this.state.statsData.length) return;

    // destroy instance lama
    if (this.statsTable) {
      this.statsTable.destroy();
      el.innerHTML = "";
    }

    const columns = [
      {
        title: "Nama Mahasiswa",
        field: "student_name",
        frozen: true,
        headerSort: true,
        headerFilter: "input",
        headerFilterPlaceholder: "🔍 Cari…",
      },
      {
        title: "Kelas",
        field: "class_name",
        headerSort: true,
        headerFilter: "input",
      },
      {
        title: "Total Logbook",
        field: "total_logbooks",
        headerSort: true,
        hozAlign: "right",
      },
      {
        title: "Rata-rata/Minggu",
        field: "avg_logbooks_per_week",
        headerSort: true,
        hozAlign: "right",
        formatter: (cell) => parseFloat(cell.getValue()).toFixed(2),
      },
      {
        title: "Std. Deviasi",
        field: "std_dev_logbooks",
        headerSort: true,
        hozAlign: "right",
        formatter: (cell) => parseFloat(cell.getValue()).toFixed(2),
      },
      {
        title: "Minggu Aktif",
        field: "active_weeks",
        headerSort: true,
        hozAlign: "right",
      },
      {
        title: "% Partisipasi",
        field: "participation_rate",
        headerSort: true,
        hozAlign: "right",
        formatter: (cell) => parseFloat(cell.getValue()).toFixed(2) + "%",
      },
    ];

    // Calculate averages for numeric columns
    const averageRow = {
      student_name: "Rata-rata",
      class_name: "",
      total_logbooks: +(
        this.state.statsData.reduce((sum, row) => sum + row.total_logbooks, 0) /
        this.state.statsData.length
      ).toFixed(2),
      avg_logbooks_per_week: +(
        this.state.statsData.reduce(
          (sum, row) => sum + row.avg_logbooks_per_week,
          0
        ) / this.state.statsData.length
      ).toFixed(2),
      std_dev_logbooks: +(
        this.state.statsData.reduce(
          (sum, row) => sum + row.std_dev_logbooks,
          0
        ) / this.state.statsData.length
      ).toFixed(2),
      active_weeks: +(
        this.state.statsData.reduce((sum, row) => sum + row.active_weeks, 0) /
        this.state.statsData.length
      ).toFixed(2),
      participation_rate: +(
        this.state.statsData.reduce(
          (sum, row) => sum + row.participation_rate,
          0
        ) / this.state.statsData.length
      ).toFixed(2),
    };

    // Add average row at the top
    const tableData = [averageRow, ...this.state.statsData];

    this.statsTable = new Tabulator(el, {
      data: tableData,
      columns: columns,
      layout: "fitDataTable",
      height: "800px",
      pagination: true,
      paginationSize: 100,
      paginationSizeSelector: [10, 25, 50, 100],
      frozenRows: 1,
      columnDefaults: {
        resizable: true,
      },
    });
  }

  renderExtractionStatsTable() {
    const el = document.getElementById("extraction-stats-table");
    if (!el || !this.state.extractionStatsData.length) return;

    // destroy instance lama
    if (this.extractionStatsTable) {
      this.extractionStatsTable.destroy();
      el.innerHTML = "";
    }

    const columns = [
      {
        title: "Nama Mahasiswa",
        field: "student_name",
        frozen: true,
        headerFilter: "input",
        headerFilterPlaceholder: "🔍 Cari…",
      },
      {
        title: "Kelas",
        field: "class_name",
        headerSort: true,
        headerFilter: "input",
      },
      {
        title: "Jumlah Logbook",
        field: "total_extraction",
        headerSort: true,
        hozAlign: "right",
      },
      {
        title: "Rata-rata Label/Logbook",
        field: "avg_extraction_per_logbook",
        headerSort: true,
        hozAlign: "right",
        formatter: (cell) => parseFloat(cell.getValue()).toFixed(2),
      },
      {
        title: "Std. Deviasi Label/Logbook",
        field: "std_extraction_per_logbook",
        headerSort: true,
        hozAlign: "right",
        formatter: (cell) => parseFloat(cell.getValue()).toFixed(2),
      },
    ]; // Calculate averages for numeric columns
    const averageRow = {
      student_name: "Rata-rata",
      class_name: "",
      total_extraction: +(
        this.state.extractionStatsData.reduce(
          (sum, row) => sum + row.total_extraction,
          0
        ) / this.state.extractionStatsData.length
      ).toFixed(2),
      avg_extraction_per_logbook: +(
        this.state.extractionStatsData.reduce(
          (sum, row) => sum + row.avg_extraction_per_logbook,
          0
        ) / this.state.extractionStatsData.length
      ).toFixed(2),
      std_extraction_per_logbook: +(
        this.state.extractionStatsData.reduce(
          (sum, row) => sum + row.std_extraction_per_logbook,
          0
        ) / this.state.extractionStatsData.length
      ).toFixed(2),
    };

    // Add average row at the top
    const tableData = [averageRow, ...this.state.extractionStatsData];

    this.extractionStatsTable = new Tabulator(el, {
      data: tableData,
      columns: columns,
      layout: "fitDataTable",
      height: "800px",
      pagination: true,
      paginationSize: 100,
      paginationSizeSelector: [10, 25, 50, 100],
      frozenRows: 1,
      columnDefaults: {
        resizable: true,
      },
    });
  }
  renderStudentWeeklyActivityChart() {
    const chartDom = document.getElementById("chart_student_activity");
    if (!chartDom) return;
    if (this.echarts.chart_student_activity) {
      this.echarts.chart_student_activity.dispose();
    }
    const chart = echarts.init(chartDom);

    const weekLabels = [
      ...new Set(
        this.state.studentWeeklyStats
          .sort(
            (a, b) => new Date(a.week_start_date) - new Date(b.week_start_date)
          )
          .map((s) => s.week_label)
      ),
    ];

    // Calculate averages
    const avgLogbooks =
      this.state.studentWeeklyStats.reduce(
        (sum, w) => sum + w.total_logbooks,
        0
      ) / weekLabels.length;
    const avgExtractions =
      this.state.studentWeeklyActivity.reduce(
        (sum, w) => sum + w.extraction_count,
        0
      ) / weekLabels.length;
    const extractionRatios = this.state.studentWeeklyStats.map((w, idx) => {
      const extractionCount =
        this.state.studentWeeklyActivity[idx]?.extraction_count || 0;
      const logbookCount = w.total_logbooks || 1;
      return extractionCount / logbookCount;
    });
    const maxRatio = Math.max(...extractionRatios);
    const yAxisMaxRatio = Math.ceil(maxRatio * 1.1);

    const option = {
      title: {
        text: "Aktivitas Logbook & Ekstraksi Mahasiswa",
        left: "center",
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params) => {
          const index = params[0].dataIndex;
          const logbookData = this.state.studentWeeklyStats[index];
          const extractionData = this.state.studentWeeklyActivity[index];
          const ratio = extractionRatios[index];

          let result = `${logbookData.week_label} (${this.formatDate(
            logbookData.week_start_date
          )} - ${this.formatDate(logbookData.week_end_date)})<br/>`;

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
          data: this.state.studentWeeklyActivity.map((w) => w.extraction_count),
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
            data: [{ yAxis: avgExtractions }],
            lineStyle: { type: "dashed", color: "#5470C6" },
          },
        },
        {
          name: "Jumlah Logbook",
          type: "line",
          data: this.state.studentWeeklyStats.map((w) => w.total_logbooks),
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
            data: [{ yAxis: avgLogbooks }],
            lineStyle: { type: "dashed", color: "#91CC75" },
          },
        },
        {
          name: "Rasio Ekstraksi",
          type: "line",
          data: extractionRatios,
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
                  extractionRatios.reduce((sum, r) => sum + r, 0) /
                  extractionRatios.length,
              },
            ],
            lineStyle: { type: "dashed", color: "#EE6666" },
          },
        },
      ],
    };

    chart.setOption(option);
    this.echarts.chart_student_activity = chart;
  }

  // Add this method to the LogbookStudentAnalytics class
  formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, "0")}/${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;
  }

  downloadTableData(tableType, format) {
    let table;
    let filename;

    // Tambahkan logging untuk debugging
    console.log("Table type:", tableType);
    console.log("Stats table:", this.statsTable);
    console.log("Extraction table:", this.extractionStatsTable);
    console.log("Points table:", this.table);

    switch (tableType) {
      case "stats":
        if (!this.statsTable) {
          console.error("Stats table belum diinisialisasi");
          return;
        }
        table = this.statsTable;
        filename = "statistik_aktivitas";
        break;

      case "extraction":
        if (!this.extractionStatsTable) {
          console.error("Extraction stats table belum diinisialisasi");
          return;
        }
        table = this.extractionStatsTable;
        filename = "statistik_ekstraksi";
        break;

      case "points":
        if (!this.table) {
          console.error("Points table belum diinisialisasi");
          return;
        }
        table = this.table;
        filename = "poin_mahasiswa";
        break;

      default:
        console.error("Tipe tabel tidak valid:", tableType);
        return;
    }

    if (table) {
      try {
        if (format === "csv") {
          table.download("csv", `${filename}.csv`, {
            bom: true,
            delimiter: ",",
          });
        } else if (format === "xlsx") {
          table.download("xlsx", `${filename}.xlsx`, {
            sheetName: filename,
          });
        }
      } catch (error) {
        console.error("Error saat download:", error);
      }
    }
  }

  downloadClusteringData() {
    // Persiapkan data
    const headers = ["Nama Mahasiswa", "Cluster", "Nilai X", "Nilai Y"];
    const rows = this.state.students.map((s) => [
      s.student_name,
      s.cluster,
      s.x.toFixed(2),
      s.y.toFixed(2),
    ]);

    // Gabung headers dan rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Buat blob dan trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "clustering_data.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  renderSimilarityHeatmap() {
    const container = document.getElementById("chart_similarity");
    if (!container || !this.state.similarityData) return;

    if (this.echarts.chart_similarity) {
      this.echarts.chart_similarity.dispose();
    }

    const chart = echarts.init(container);
    const { similarity_matrix, week_labels } = this.state.similarityData;

    // Transform data untuk heatmap
    const data = [];
    similarity_matrix.forEach((row, i) => {
      row.forEach((val, j) => {
        data.push([i, j, val.toFixed(2)]);
      });
    });

    const option = {
      title: {
        text: "Similaritas Logbook Antar Minggu",
        left: "center",
      },
      tooltip: {
        position: "top",
        formatter: function (params) {
          const weekI = week_labels[params.data[0]];
          const weekJ = week_labels[params.data[1]];
          const similarity = params.data[2];
          return `${weekI} vs ${weekJ}: ${similarity}`;
        },
      },
      grid: {
        left: "15%",
        right: "15%",
        top: "15%",
        bottom: "15%",
      },
      xAxis: {
        type: "category",
        data: week_labels,
        splitArea: {
          show: true,
        },
      },
      yAxis: {
        type: "category",
        data: week_labels,
        splitArea: {
          show: true,
        },
      },
      visualMap: {
        min: 0,
        max: 1,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: "0%",
      },
      series: [
        {
          name: "Similaritas",
          type: "heatmap",
          data: data,
          label: {
            show: true,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    };

    chart.setOption(option);
    this.echarts.chart_similarity = chart;
  }
}

LogbookStudentAnalytics.template =
  "jtk_logbook_analytics.LogbookStudentAnalytics";

registry
  .category("actions")
  .add(
    "jtk_logbook_analytics.logbook_student_analytics",
    LogbookStudentAnalytics
  );
