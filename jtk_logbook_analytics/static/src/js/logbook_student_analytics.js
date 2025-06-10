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
    });
    this.table = null; // simpan instance Tabulator
    onWillStart(async () => {
      const projectCourseId = getRecordIdFromPath();
      if (!projectCourseId) return;

      // clustering data
      const res = await rpc("/logbook/clustering/label", {
        project_course_id: projectCourseId,
      });
      this.state.students = res.students || [];
      this.state.components = res.components_info || {};

      // normalisasi data
      this.state.normData = await this.orm.searchRead(
        "logbook.extraction.student.label.norm",
        [["project_course_id", "=", projectCourseId]],
        [
          "student_id",
          "label_id",
          "avg_norm_point",
          "category_id",
          "subcategory_id",
        ]
      );

      // bangun struktur studentList & categories
      const studentMap = {};
      const categoryMap = new Map();
      for (const row of this.state.normData) {
        const [sid, sname] = row.student_id;
        const [lid, lname] = row.label_id;
        const [cid, cname] = row.category_id;
        const subid = row.subcategory_id?.[0] ?? null;
        const subname = row.subcategory_id?.[1] ?? "-";
        const point = row.avg_norm_point;

        // studentMap
        if (!studentMap[sid]) {
          studentMap[sid] = {
            student_id: sid,
            student_name: sname,
            scores: {},
          };
        }
        studentMap[sid].scores[`label_${lid}`] = point;

        // kategori → subkategori → label
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
      this.state.studentList = Object.values(studentMap);
      this.state.categories = Array.from(categoryMap.values()).map((cat) => ({
        ...cat,
        subcategories: Array.from(cat.subcategories.values()),
      }));
    });

    onMounted(() => {
      // setelah DOM siap dan state telah terisi
      setTimeout(() => {
        this.renderChart();
        this.renderTable();
      }, 0);
    });
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
    ];

    // =========================
    // Build data rows
    // =========================
    const data = this.state.studentList.map((s) => {
      const row = { student_name: s.student_name };
      Object.entries(s.scores).forEach(([key, val]) => {
        row[key] = val != null ? parseFloat(val) : null;
      });
      return row;
    });

    // =========================
    // Init Tabulator
    // =========================
    this.table = new Tabulator(el, {
      data,
      columns,
      layout: "fitDataTable",
      responsiveLayout: false,
      height: "800px",
      rowHeight: 28,
      columnVertAlign: "middle",
      headerVertAlign: "middle",
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
