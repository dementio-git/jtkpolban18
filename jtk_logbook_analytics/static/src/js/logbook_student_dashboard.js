/** @odoo-module **/
import { Component, useRef, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class LogbookStudentDashboard extends Component {
  setup() {
    this.orm = useService("orm");
    this.state = useState({
      projects: [],
      classes: [],
      labelGroups: [],
      students: [],
      selectedProjectId: null,
      selectedLabelGroupId: null,
      selectedStudentClassId: null,
      selectedStudentIds: [],
      lineChartData: [],
      selectedAverageClassId: null,
      averageLineData: [],
    });

    this.lineChartRef = useRef("lineChartRef");
    this.chart = null;

    onWillStart(async () => {
      this.state.projects = await this.orm.searchRead("project.course", [], ["name"]);
    });
  }

  async onProjectChange(ev) {
    const pid = parseInt(ev.target.value) || null;
    this.state.selectedProjectId = pid;
    this.state.selectedLabelGroupId = null;
    this.state.selectedStudentClassId = null;
    this.state.selectedStudentIds = [];
    this.state.labelGroups = [];
    this.state.classes = [];
    this.state.students = [];
    this.state.lineChartData = [];
    this._destroyChart(this.chart);

    if (!pid) return;

    // Ambil kelas terkait
    const [project] = await this.orm.read("project.course", [pid], ["class_ids", "logbook_label_ids"]);

    if (project.class_ids?.length) {
      const classRecs = await this.orm.read("class.class", project.class_ids, ["name"]);
      this.state.classes = classRecs.map((c) => ({ id: c.id, name: c.name }));
    }

    // Ambil semua group dari label
    const labelIds = project.logbook_label_ids || [];
    if (labelIds.length > 0) {
      const labels = await this.orm.read("logbook.label", labelIds, ["group_id"]);
      const groupIds = [...new Set(labels.map((l) => l.group_id?.[0]).filter(Boolean))];
      if (groupIds.length > 0) {
        this.state.labelGroups = await this.orm.read("logbook.label.group", groupIds, ["name"]);
      }
    }

    await this._loadAllStudents(); // Awal kosong atau semua
  }

  async _loadAllStudents() {
    const domain = [];
    if (this.state.selectedStudentClassId) {
      domain.push(["class_id", "=", this.state.selectedStudentClassId]);
    }
    this.state.students = await this.orm.searchRead("student.student", domain, ["name", "nim"]);
  }


  async onLabelGroupChange(ev) {
    const gid = parseInt(ev.target.value) || null;
    this.state.selectedLabelGroupId = gid;
    await this._loadLineChartData();
  }

  async onStudentClassChange(ev) {
    const cid = parseInt(ev.target.value) || null;
    this.state.selectedStudentClassId = cid;
    await this._loadAllStudents();  // akan di-filter berdasarkan selectedStudentClassId
    this.state.selectedStudentIds = this.state.students.map((s) => s.id);
    await this._loadLineChartData();
  }


  toggleStudent(id) {
    const idx = this.state.selectedStudentIds.indexOf(id);
    if (idx >= 0) this.state.selectedStudentIds.splice(idx, 1);
    else this.state.selectedStudentIds.push(id);
    this._loadLineChartData();
  }

  async clearStudentSelection() {
    this.state.selectedStudentIds = [];
    await this._loadLineChartData();
  }

  async _loadLineChartData() {
    const domain = [
        ["project_course_id", "=", this.state.selectedProjectId],
        ["group_id", "=", this.state.selectedLabelGroupId],
        ["student_id", "in", this.state.selectedStudentIds],
    ].filter((d) => d[2] != null);

    const data = await this.orm.searchRead("logbook.label.analytics", domain, [
        "student_id",
        "student_nim",
        "week_date",
        "total_point",
        "week_id",
        "class_id",
    ]);
    this.state.lineChartData = data;

    const avgClass = this.state.selectedAverageClassId;
    const avgDomain = [
      ["project_course_id", "=", this.state.selectedProjectId],
      ["group_id", "=", this.state.selectedLabelGroupId],
    ];

    if (avgClass && avgClass !== "__all__") {
      avgDomain.push(["class_id", "=", parseInt(avgClass)]);
    }

    const rawAvgData = await this.orm.searchRead("logbook.label.weekly.avg", avgDomain, [
      "week_date", "avg_point",
    ]);

    if (!avgClass || avgClass === "__all__") {
      const grouped = {};
      for (const row of rawAvgData) {
        const date = row.week_date;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(row.avg_point);
      }

      this.state.averageLineData = Object.entries(grouped).map(([date, values]) => ({
        week_date: date,
        avg_point: values.reduce((a, b) => a + b, 0) / values.length,
      }));
    } else {
      this.state.averageLineData = rawAvgData;
    }



    this._renderChart();
   }



  async onAverageClassChange(ev) {
    const val = ev.target.value;
    this.state.selectedAverageClassId = val === "" ? null : val;
    await this._loadLineChartData();
  }


 _renderChart() {
    const canvas = this.lineChartRef.el;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (this.chart) this.chart.destroy();

    // Ambil tanggal minggu unik dan label minggu dari lineChartData
    const uniqDates = Array.from(
        new Set(this.state.lineChartData.map((r) => r.week_date).filter(Boolean))
    ).sort();

    const weekByDate = {};
    this.state.lineChartData.forEach((r) => {
        if (r.week_date && r.week_id) {
            weekByDate[r.week_date] = r.week_id[1];
        }
    });

    const labels = uniqDates.map((d) => `${weekByDate[d] || "?"} (${d})`);

    // Kelompokkan data mahasiswa
    const byStu = {};
    this.state.lineChartData.forEach((r) => {
        const nim = r.student_nim;
        const name = r.student_id?.[1] || "Unknown";
        const date = r.week_date;
        if (!nim || !date) return;
        if (!byStu[nim]) {
            byStu[nim] = { label: `${name} (${nim})`, data: {} };
        }
        byStu[nim].data[date] = (byStu[nim].data[date] || 0) + r.total_point;
    });

    const datasets = Object.values(byStu).map((stu, i) => ({
        label: stu.label,
        data: uniqDates.map((d) => stu.data[d] || 0),
        borderColor: `hsl(${(i * 60) % 360},70%,50%)`,
        fill: false,
        tension: 0.3,
    }));

    // ➕ Tambahkan garis rata-rata dari SQL View
    if (this.state.averageLineData.length) {
        const avgMap = {};
        this.state.averageLineData.forEach((r) => {
            avgMap[r.week_date] = r.avg_point;
        });

        datasets.push({
            label: "Rata-rata",
            data: uniqDates.map((d) => avgMap[d] || null),
            borderColor: "#000000",
            borderDash: [6, 6],
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: false,
        });
    }

    // 🔧 Render Chart
    this.chart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "top" },
                title: {
                    display: true,
                    text: "Perkembangan Poin Mahasiswa per Tanggal",
                },
            },
            scales: {
                x: {
                    type: "category",
                    ticks: { autoSkip: false, maxRotation: 45 },
                    title: { display: true, text: "Minggu (Tanggal)" },
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Total Poin" },
                },
            },
        },
    });
    }


  _destroyChart(chart) {
    if (chart) chart.destroy();
  }
}

LogbookStudentDashboard.template = "jtk_logbook_analytics.LogbookStudentDashboard";
registry.category("actions").add("jtk_logbook_analytics.logbook_student_dashboard", LogbookStudentDashboard);
