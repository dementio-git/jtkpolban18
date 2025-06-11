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
  if (m) return parseInt(m[1], 10);
  m = window.location.pathname.split("/").find((seg) => /^\d+$/.test(seg));
  return m ? parseInt(m, 10) : null;
}

export class LogbookStudentAnalytics extends Component {
  setup() {
    this.orm = useService("orm");    
    this.state = useState({
      students: [],
      components: {},
      normData: [],
      studentList: [],
      categories: [],
      statsData: [],
      extractionStatsData: [], // Tambah state baru
    });
    this.table = null;
    this.statsTable = null;
    this.extractionStatsTable = null;

    onWillStart(async () => {
      const projectCourseId = getRecordIdFromPath();
      if (!projectCourseId) return;      
      await Promise.all([
        this.fetchClusteringData(projectCourseId),
        this.fetchNormalizationData(projectCourseId),
        this.fetchStatsData(projectCourseId),
        this.fetchExtractionStatsData(projectCourseId), // Tambah fungsi fetch baru
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

  processDataStructures() {
    const studentMap = {};
    const categoryMap = new Map();

    for (const row of this.state.normData) {
      const [sid, sname] = row.student_id;
      const [lid, lname] = row.label_id;
      const [cid, cname] = row.category_id;
      const subid = row.subcategory_id?.[0] ?? null;
      const subname = row.subcategory_id?.[1] ?? "-";      const point = row.avg_norm_point;
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
    const data = this.state.students.map((s) => ({
      name: s.student_name,
      value: [s.x, s.y],
      cluster: s.cluster,
    }));
    chart.setOption({
      title: { text: "Clustering Mahasiswa", left: "center" },
      tooltip: {
        trigger: "item",
        formatter: ({ data }) =>
          `Mahasiswa: ${data.name}<br/>Cluster: ${data.cluster}
           <br/>X: ${data.value[0].toFixed(2)}
           <br/>Y: ${data.value[1].toFixed(2)}`,
      },
      xAxis: {
        name: this.state.components.x_axis_name || "X-Axis",
        scale: true,
      },
      yAxis: {
        name: this.state.components.y_axis_name || "Y-Axis",
        scale: true,
      },
      series: [
        {
          type: "scatter",
          data,
          itemStyle: {
            color: (params) => this.getColor(params.data.cluster),
          },
        },
      ],
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
      },      ...sortedCategories.map((cat) => ({
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
        formatter: function(cell) {
          const v = cell.getValue();
          if (v == null) return "-";
          return parseFloat(v).toFixed(2);
        },
      },
    ];    // Build data rows
    const data = this.state.studentList.map((s) => {
      const row = { 
        student_name: s.student_name,
        class_name: s.class_name
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
    });    // Calculate average row
    const averageRow = {
      student_name: "Rata-rata",
      class_name: "",
      total: data.reduce((sum, row) => sum + (row.total || 0), 0) / data.length,
    };

    // Calculate averages for each label column
    this.state.categories.forEach(category => {
      category.subcategories.forEach(sub => {
        sub.labels.forEach(label => {
          const fieldName = `label_${label.id}`;
          const values = data
            .map(row => row[fieldName])
            .filter(val => val != null);
          
          if (values.length > 0) {
            averageRow[fieldName] = values.reduce((sum, val) => sum + val, 0) / values.length;
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
      total_logbooks: this.state.statsData.reduce((sum, row) => sum + row.total_logbooks, 0) / this.state.statsData.length,
      avg_logbooks_per_week: this.state.statsData.reduce((sum, row) => sum + row.avg_logbooks_per_week, 0) / this.state.statsData.length,
      std_dev_logbooks: this.state.statsData.reduce((sum, row) => sum + row.std_dev_logbooks, 0) / this.state.statsData.length,
      active_weeks: this.state.statsData.reduce((sum, row) => sum + row.active_weeks, 0) / this.state.statsData.length,
      participation_rate: this.state.statsData.reduce((sum, row) => sum + row.participation_rate, 0) / this.state.statsData.length,
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
      },      {
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
    ];    // Calculate averages for numeric columns
    const averageRow = {
      student_name: "Rata-rata",
      class_name: "",
      total_extraction: this.state.extractionStatsData.reduce((sum, row) => sum + row.total_extraction, 0) / this.state.extractionStatsData.length,
      avg_extraction_per_logbook: this.state.extractionStatsData.reduce((sum, row) => sum + row.avg_extraction_per_logbook, 0) / this.state.extractionStatsData.length,
      std_extraction_per_logbook: this.state.extractionStatsData.reduce((sum, row) => sum + row.std_extraction_per_logbook, 0) / this.state.extractionStatsData.length,
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

  // di dalam class, di bawah renderTable()
  downloadCSV() {
    if (this.table) {
      this.table.download("csv", "logbook_data.csv", {
        bom: true, // untuk encoding UTF-8
        delimiter: ",",
      });
    }
  }
  downloadXLSX() {
    if (this.table) {
      this.table.download("xlsx", "logbook_data.xlsx", {
        sheetName: "Logbook",
      });
    }
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
