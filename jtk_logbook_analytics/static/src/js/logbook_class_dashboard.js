/** @odoo-module **/
import { Component, useRef, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class LogbookClassDashboard extends Component {
  setup() {
    this.orm = useService("orm");
    this.state = useState({
      projects: [],
      weeks: [],
      classes: [],
      selectedProjectId: null,
      selectedWeekId: null,
      selectedClassId: null,
      weekData: [],
      classData: [],
      studentData: [],
    });

    this.barChartRef = useRef("barChartRef");
    this.classChartRef = useRef("classChartRef");
    this.studentChartRef = useRef("studentChartRef");

    this.chart1 = null;
    this.chart2 = null;
    this.chart3 = null;

    onWillStart(async () => {
      this.state.projects = await this.orm.searchRead(
        "project.course",
        [],
        ["name"]
      );
    });
  }

  async onProjectChange(ev) {
    const pid = parseInt(ev.target.value) || null;
    this.state.selectedProjectId = pid;
    this.state.selectedWeekId = null;
    this.state.selectedClassId = null;
    this.state.selectedWeekIdChart3 = null;
    this.state.selectedClassIdChart3 = null;
    this.state.weeks = [];
    this.state.classes = [];
    this.state.weekData = [];
    this.state.classData = [];
    this.state.studentData = [];
    this._destroyChart(this.chart1);
    this._destroyChart(this.chart2);
    this._destroyChart(this.chart3);

    if (!pid) return;

    this.state.weeks = await this.orm.searchRead(
      "week.line",
      [["course_id", "=", pid]],
      ["name"]
    );
    const [project] = await this.orm.read(
      "project.course",
      [pid],
      ["class_ids"]
    );
    if (project.class_ids.length) {
      const classRecs = await this.orm.read("class.class", project.class_ids, [
        "name",
      ]);
      this.state.classes = classRecs.map((c) => ({ id: c.id, name: c.name }));
    }

    // 1. Ambil semua label dari project yang dipilih
    const labels = await this.orm.read(
      "project.course",
      [pid],
      ["logbook_label_ids"]
    );
    const labelIds = labels[0]?.logbook_label_ids || [];

    if (labelIds.length > 0) {
      // 2. Ambil semua label dan dapatkan group_id
      const labelRecs = await this.orm.read("logbook.label", labelIds, [
        "group_id",
      ]);

      // 3. Ambil semua group_id unik
      const groupIds = [
        ...new Set(labelRecs.map((l) => l.group_id?.[0]).filter(Boolean)),
      ];

      // 4. Ambil semua group berdasarkan ID
      if (groupIds.length > 0) {
        this.state.labelGroups = await this.orm.read(
          "logbook.label.group",
          groupIds,
          ["name"]
        );
      } else {
        this.state.labelGroups = [];
      }
    } else {
      this.state.labelGroups = [];
    }
  }

  async onWeekChange(ev) {
    const wid = parseInt(ev.target.value) || null;
    this.state.selectedWeekId = wid;
    this.state.weekData = [];
    this._destroyChart(this.chart1);
    this._destroyChart(this.chart3);

    if (!this.state.selectedProjectId || !wid) return;

    // Chart #1
    this.state.weekData = await this.orm.searchRead(
      "logbook.label.analytics",
      [
        ["project_course_id", "=", this.state.selectedProjectId],
        ["week_id", "=", wid],
      ],
      ["label_id", "class_id", "total_point"]
    );
    this._renderWeekChart();
  }

  async onWeekChart3Change(ev) {
    this.state.selectedWeekIdChart3 = parseInt(ev.target.value) || null;
    await this._loadStudentDataChart3();
  }

  async onClassChart3Change(ev) {
    this.state.selectedClassIdChart3 = parseInt(ev.target.value) || null;
    await this._loadStudentDataChart3();
  }

  async onClassChange(ev) {
    const cid = parseInt(ev.target.value) || null;
    this.state.selectedClassId = cid;
    this.state.classData = [];
    this._destroyChart(this.chart2);
    this._destroyChart(this.chart3);

    // Chart #2
    if (this.state.selectedProjectId && cid) {
      this.state.classData = await this.orm.searchRead(
        "logbook.label.analytics",
        [
          ["project_course_id", "=", this.state.selectedProjectId],
          ["class_id", "=", cid],
        ],
        ["label_id", "week_id", "week_date", "total_point"] // pastikan ada week_date atau ambil via week_id[1]
      );

      this._renderClassChart();
    }
  }

  async _loadStudentData() {
    const pid = this.state.selectedProjectId;
    const wid = this.state.selectedWeekId;
    const cid = this.state.selectedClassId;

    if (!pid || !wid) {
      this.state.studentData = [];
      this._destroyChart(this.chart3);
      return;
    }

    const domain = [
      ["project_course_id", "=", pid],
      ["week_id", "=", wid],
    ];
    if (cid) {
      domain.push(["class_id", "=", cid]);
    }

    this.state.studentData = await this.orm.searchRead(
      "logbook.label.analytics",
      domain,
      ["student_id", "student_nim", "group_id", "total_point"] // ⬅️ tambahkan "student_nim"
    );
    this._renderStudentChart();
  }

  async _loadStudentDataChart3() {
    const pid = this.state.selectedProjectId;
    const wid = this.state.selectedWeekIdChart3;
    const cid = this.state.selectedClassIdChart3;

    if (!pid || !wid) {
      this.state.studentData = [];
      this._destroyChart(this.chart3);
      return;
    }

    const domain = [
      ["project_course_id", "=", pid],
      ["week_id", "=", wid],
    ];
    if (cid) {
      domain.push(["class_id", "=", cid]);
    }

    this.state.studentData = await this.orm.searchRead(
      "logbook.label.analytics",
      domain,
      ["student_id", "student_nim", "group_id", "total_point"]
    );
    this._renderStudentChart();
  }

  _renderWeekChart() {
    const canvas = this.barChartRef.el;
    const ctx = canvas.getContext("2d");
    this._destroyChart(this.chart1);

    const byClass = {},
      labels = [];
    for (const r of this.state.weekData) {
      const cls = r.class_id[1] || "Unknown";
      const lbl = r.label_id[1] || "Unknown";
      byClass[cls] = byClass[cls] || {};
      byClass[cls][lbl] = (byClass[cls][lbl] || 0) + (r.total_point || 0);
      if (!labels.includes(lbl)) labels.push(lbl);
    }

    const datasets = Object.keys(byClass).map((cls, i) => ({
      label: cls,
      data: labels.map((l) => byClass[cls][l] || 0),
      backgroundColor: `hsl(${(i * 60) % 360}, 70%, 60%)`,
    }));

    this.chart1 = new window.Chart(ctx, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
          title: { display: true, text: "Poin per Kelas (Minggu terpilih)" },
        },
        scales: {
          x: {
            stacked: false,
            ticks: { autoSkip: true, maxRotation: 45 },
            barThickness: "flex",
          },
          y: { beginAtZero: true },
        },
      },
    });
  }

  _renderClassChart() {
    const canvas = this.classChartRef.el;
    const ctx = canvas.getContext("2d");
    this._destroyChart(this.chart2);

    const byLabel = {}; // { label: { week: total } }
    const weekDateMap = new Map(); // Untuk urutan week berdasarkan tanggal
    const weekLabels = new Set(); // Untuk sumbu X

    for (const r of this.state.classData) {
      const weekName = r.week_id?.[1];
      const label = r.label_id?.[1];
      const weekDate = r.week_date;

      if (!weekName || !label) continue;

      if (weekDate && !weekDateMap.has(weekName)) {
        weekDateMap.set(weekName, weekDate);
      }

      byLabel[label] = byLabel[label] || {};
      byLabel[label][weekName] =
        (byLabel[label][weekName] || 0) + (r.total_point || 0);
      weekLabels.add(weekName);
    }

    // Urutkan minggu berdasarkan tanggal (X axis)
    const sortedWeeks = [...weekDateMap.entries()]
      .sort((a, b) => new Date(a[1]) - new Date(b[1]))
      .map(([week]) => week);

    // Bangun datasets (tiap label = 1 garis)
    const datasets = Object.entries(byLabel).map(([label, weekData], i) => ({
      label,
      data: sortedWeeks.map((week) => weekData[week] || 0),
      borderColor: `hsl(${(i * 60) % 360}, 70%, 50%)`,
      fill: false,
      tension: 0.3,
    }));

    this.chart2 = new window.Chart(ctx, {
      type: "line",
      data: {
        labels: sortedWeeks,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
          title: {
            display: true,
            text: "Perkembangan Poin per Label (Kelas terpilih)",
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Minggu" },
            ticks: { autoSkip: false, maxRotation: 45 },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Total Poin" },
          },
        },
      },
    });
  }

  _renderStudentChart() {
    const canvas = this.studentChartRef.el;
    const ctx = canvas.getContext("2d");
    this._destroyChart(this.chart3);

    const byGroup = {};
    const studentMap = new Map();

    // Step 1: kumpulkan data dan mapping berdasarkan NIM
    for (const r of this.state.studentData) {
      const student = r.student_id;
      if (!student || student.length < 2) continue;

      const [id, name] = student;
      const nim = r.student_nim || "000000"; // fallback jika tidak tersedia

      const group = r.group_id?.[1] || "No Group";

      // simpan mapping nim → nama
      studentMap.set(nim, { name, nim });

      if (!byGroup[group]) byGroup[group] = {};
      byGroup[group][nim] = (byGroup[group][nim] || 0) + (r.total_point || 0);
    }

    // Step 2: urutkan berdasarkan NIM
    const sortedNIMs = Array.from(studentMap.keys()).sort();

    // Step 3: buat label nama (dari NIM) dan datasets
    const studentLabels = sortedNIMs.map((nim) => studentMap.get(nim).name);
    const datasets = Object.keys(byGroup).map((group, idx) => ({
      label: group,
      data: sortedNIMs.map((nim) => byGroup[group][nim] || 0),
      backgroundColor: `hsl(${(idx * 72) % 360}, 70%, 60%)`,
    }));

    this.chart3 = new window.Chart(ctx, {
      type: "bar",
      data: { labels: studentLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
          title: {
            display: true,
            text: "Total Poin per Student by Label Group (sorted by NIM)",
          },
        },
        scales: {
          x: { stacked: false, ticks: { autoSkip: false, maxRotation: 45 } },
          y: { stacked: false, beginAtZero: true },
        },
      },
    });
  }

  _destroyChart(chart) {
    if (chart) chart.destroy();
  }
}

LogbookClassDashboard.template = "jtk_logbook_analytics.LogbookClassDashboard";
registry
  .category("actions")
  .add("jtk_logbook_analytics.logbook_class_dashboard", LogbookClassDashboard);
