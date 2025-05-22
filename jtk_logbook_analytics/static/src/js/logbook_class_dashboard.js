/** @odoo-module **/
import { Component, useRef, useState, onWillStart, useEnv, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

function getRecordIdFromPath() {
  // Match URL pattern: /odoo/project-course/1/... or /project-course/1/...
  let m = window.location.pathname.match(
    /\/(?:odoo\/)?project-course\/(\d+)(\/|$)/
  );
  if (m) return parseInt(m[1], 10);

  // Fallback: find any standalone number (likely the ID) in legacy URL
  m = window.location.pathname.split("/").find((seg) => /^\d+$/.test(seg));
  return m ? parseInt(m, 10) : null;
}

export class LogbookClassDashboard extends Component {
  setup() {
    this.orm = useService("orm");
    this.env = useEnv();
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
      students: [],
    });

    this.echarts = { chart1: null, chart2: null, chart3: null };

    onWillStart(async () => {
      this.state.projects = await this.orm.searchRead(
        "project.course",
        [],
        ["name"]
      );
    });

    onMounted(async () => {
      const ctxId = this.props?.action?.context?.default_project_course_id;
      const urlId = getRecordIdFromPath();

      const projectId = ctxId || urlId;
      console.log("🆔 Resolved project_id:", projectId);

      if (projectId) {
        this.state.selectedProjectId = projectId;
        await this.onProjectChange({ target: { value: projectId } });
      }
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
    this._destroyChartInstance(this.chart1);
    this._destroyChartInstance(this.chart2);
    this._destroyChartInstance(this.chart3);

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
    this._destroyChartInstance(this.chart1);
    this._destroyChartInstance(this.chart3);

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
    this._destroyChartInstance(this.chart2);
    this._destroyChartInstance(this.chart3);

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
      this._destroyChartInstance(this.chart3);
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
      this.state.students = [];
      this._destroyChartInstance(this.chart3);
      return;
    }

    const domain = [
      ["project_course_id", "=", pid],
      ["week_id", "=", wid],
    ];
    if (cid) {
      domain.push(["class_id", "=", cid]);
      this.state.students = await this.orm.searchRead(
        "student.student",
        [["class_id", "=", cid]],
        ["name", "nim"]
      );
    } else {
      // ⬅️ ambil semua mahasiswa dari project jika class tidak dipilih
      const class_ids = (
        await this.orm.read("project.course", [pid], ["class_ids"])
      )[0].class_ids;
      this.state.students = await this.orm.searchRead(
        "student.student",
        [["class_id", "in", class_ids]],
        ["name", "nim"]
      );
    }

    this.state.studentData = await this.orm.searchRead(
      "logbook.label.analytics",
      domain,
      ["student_id", "student_nim", "group_id", "total_point"]
    );

    this._renderStudentChart();
  }

  _renderWeekChart() {
    this._destroyChartInstance(this.chart1);

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

    const dom = document.getElementById("chart1");
    if (!dom) return;
    this.echarts.chart1?.dispose?.();
    this.echarts.chart1 = echarts.init(dom);

    this.echarts.chart1.setOption({
      tooltip: { trigger: "axis" },
      legend: {
        top: 10,
        data: datasets.map((ds) => ds.label),
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: {
          interval: 0,
          rotate: 30,
          fontSize: 11,
        },
      },
      yAxis: { type: "value" },
      series: datasets.map((ds) => ({
        name: ds.label, // ⬅️ penting untuk muncul di legend
        type: "bar",
        data: ds.data,
        itemStyle: { color: ds.backgroundColor },
      })),
    });
  }

  _renderClassChart() {
    this._destroyChartInstance(this.chart2);

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
    const datasets = Object.entries(byLabel).map(
      ([labelName, weekData], i) => ({
        name: labelName, // ⬅️ ini penting untuk legend di ECharts
        type: "line",
        smooth: true,
        data: sortedWeeks.map((week) => weekData[week] || 0),
        lineStyle: {
          color: `hsl(${(i * 60) % 360}, 70%, 50%)`,
        },
        itemStyle: {
          color: `hsl(${(i * 60) % 360}, 70%, 50%)`,
        },
      })
    );

    const dom = document.getElementById("chart2");
    if (!dom) return;
    this.echarts.chart2?.dispose?.();
    this.echarts.chart2 = echarts.init(dom);

    this.echarts.chart2.setOption({
      tooltip: { trigger: "axis", confine: true },
      legend: {
        type: "scroll",
        top: 10,
        orient: "horizontal",
        itemWidth: 14,
        itemHeight: 10,
        textStyle: { fontSize: 10 },
      },
      xAxis: {
        type: "category",
        data: sortedWeeks,
        axisLabel: {
          rotate: 30,
          interval: 0,
        },
      },
      yAxis: {
        type: "value",
      },
      series: datasets,
    });
  }

  _renderStudentChart() {
    this._destroyChartInstance("chart3");

    const byGroup = {};
    const studentMap = new Map();

    // ✅ Validasi tambahan: pastikan students terisi array
    if (!Array.isArray(this.state.students)) {
      console.warn("state.students belum tersedia.");
      this.state.students = []; // fallback agar tidak error
    }

    // Langkah 1: kumpulkan semua mahasiswa dari kelas, walau tidak ada datanya
    const allNIMs = [];
    for (const student of this.state.students) {
      if (student?.nim && student?.name) {
        allNIMs.push(student.nim);
        studentMap.set(student.nim, student.name);
      }
    }

    // Langkah 2: petakan nilai berdasarkan group
    for (const r of this.state.studentData || []) {
      const nim = r.student_nim;
      const name = r.student_id?.[1] || "Unknown";
      const group = r.group_id?.[1] || "No Group";

      // tetap tambahkan ke map jika belum
      studentMap.set(nim, name);
      if (!byGroup[group]) byGroup[group] = {};
      byGroup[group][nim] = (byGroup[group][nim] || 0) + (r.total_point || 0);
    }

    // Langkah 3: urutkan berdasarkan NIM
    const sortedNIMs = allNIMs.sort();
    const studentLabels = sortedNIMs.map((nim) => studentMap.get(nim) || nim);

    // Langkah 4: buat dataset per group
    const datasets = Object.entries(byGroup).map(([group, values], idx) => ({
      name: group,
      type: "bar",
      stack: "total",
      data: sortedNIMs.map((nim) => values[nim] || 0),
      color: `hsl(${(idx * 72) % 360}, 70%, 60%)`,
    }));

    // Render chart
    const dom = document.getElementById("chart3");
    if (!dom) return;

    this.echarts.chart3?.dispose?.();
    this.echarts.chart3 = echarts.init(dom);

    this.echarts.chart3.setOption({
      tooltip: { trigger: "axis", confine: true },
      legend: {
        type: "scroll",
        top: 10,
        textStyle: { fontSize: 11 },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: studentLabels,
        axisLabel: {
          rotate: 30,
          interval: 0,
          fontSize: 10,
        },
      },
      yAxis: {
        type: "value",
      },
      series: datasets,
    });
  }

  _destroyChartInstance(chartKey) {
    if (this.echarts[chartKey]) {
      this.echarts[chartKey].dispose();
      this.echarts[chartKey] = null;
    }
  }
}

LogbookClassDashboard.template = "jtk_logbook_analytics.LogbookClassDashboard";
registry
  .category("actions")
  .add("jtk_logbook_analytics.logbook_class_dashboard", LogbookClassDashboard);
