/** @odoo-module **/
import { Component, useRef, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class LogbookDashboard extends Component {
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
      labelGroups: [],
      students: [],
      selectedLabelGroupId: null,
      selectedStudentClassId: null, 
      selectedStudentIds: [],
      lineChartData: [],
    });

    this.barChartRef = useRef("barChartRef");
    this.classChartRef = useRef("classChartRef");
    this.studentChartRef = useRef("studentChartRef");
    this.lineChartRef    = useRef("lineChartRef");

    this.chart1 = null;
    this.chart2 = null;
    this.chart3 = null;
    this.chart4 = null; 


    onWillStart(async () => {
      this.state.projects = await this.orm.searchRead("project.course", [], ["name"]);
    });
  }

  async onProjectChange(ev) {
    const pid = parseInt(ev.target.value) || null;
    this.state.selectedProjectId = pid;
    this.state.selectedWeekId = null;
    this.state.selectedClassId = null;
    this.state.weeks = [];
    this.state.classes = [];
    this.state.weekData = [];
    this.state.classData = [];
    this.state.studentData = [];
    this._destroyChart(this.chart1);
    this._destroyChart(this.chart2);
    this._destroyChart(this.chart3);

    if (!pid) return;

    this.state.weeks = await this.orm.searchRead("week.line", [["course_id", "=", pid]], ["name"]);
    const [project] = await this.orm.read("project.course", [pid], ["class_ids"]);
    if (project.class_ids.length) {
      const classRecs = await this.orm.read("class.class", project.class_ids, ["name"]);
      this.state.classes = classRecs.map((c) => ({ id: c.id, name: c.name }));
    }

    // 1. Ambil semua label dari project yang dipilih
    const labels = await this.orm.read("project.course", [pid], ["logbook_label_ids"]);
    const labelIds = labels[0]?.logbook_label_ids || [];

    if (labelIds.length > 0) {
    // 2. Ambil semua label dan dapatkan group_id
    const labelRecs = await this.orm.read("logbook.label", labelIds, ["group_id"]);

    // 3. Ambil semua group_id unik
    const groupIds = [...new Set(labelRecs.map(l => l.group_id?.[0]).filter(Boolean))];

    // 4. Ambil semua group berdasarkan ID
    if (groupIds.length > 0) {
        this.state.labelGroups = await this.orm.read("logbook.label.group", groupIds, ["name"]);
    } else {
        this.state.labelGroups = [];
    }
    } else {
    this.state.labelGroups = [];
    }

    await this._loadAllStudents();



  }

  clearStudentSelection = async () => {
    // kosongkan semua mahasiswa yang terpilih
    this.state.selectedStudentIds = [];
    // render ulang grafik
    await this._loadLineChartData();
  };

  async _loadAllStudents() {
    // bila ada filter kelas, gunakan itu
    const domain = [];
    if (this.state.selectedStudentClassId) {
      domain.push(['class_id','=',this.state.selectedStudentClassId]);
    }
    const students = await this.orm.searchRead(
      "student.student",
      domain,
      ["name","nim"]
    );
    this.state.students = students;
  }

  // baru: handler untuk pilih Kelas di filter Mahasiswa
    async onStudentClassChange(ev) {
    const cid = parseInt(ev.target.value) || null;
    this.state.selectedStudentClassId = cid;
    // 1) Reload daftar students sesuai kelas terpilih
    await this._loadAllStudents();
    // 2) Auto-select semua student di kelas itu
    this.state.selectedStudentIds = this.state.students.map(s => s.id);
    // 3) Render ulang chart
    await this._loadLineChartData();
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
      [["project_course_id", "=", this.state.selectedProjectId], ["week_id", "=", wid]],
      ["label_id", "class_id", "total_point"]
    );
    this._renderWeekChart();

    // Chart #3 (student group chart)
    await this._loadStudentData();
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
        [["project_course_id", "=", this.state.selectedProjectId], ["class_id", "=", cid]],
        ["label_id", "week_id", "week_date", "total_point"]  // pastikan ada week_date atau ambil via week_id[1]
        );

      this._renderClassChart();
    }

    // Refresh Chart #3 (student group chart)
    if (this.state.selectedWeekId) {
      await this._loadStudentData();
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

    const domain = [["project_course_id", "=", pid], ["week_id", "=", wid]];
    if (cid) {
      domain.push(["class_id", "=", cid]);
    }

    this.state.studentData = await this.orm.searchRead(
        "logbook.label.analytics",
        domain,
        ["student_id", "student_nim", "group_id", "total_point"]  // ⬅️ tambahkan "student_nim"
    );
    this._renderStudentChart();
  }

  async onLabelGroupChange(ev) {
    const gid = parseInt(ev.target.value) || null;
    this.state.selectedLabelGroupId = gid;
    await this._loadLineChartData();
  }

  toggleStudent(id) {
    const idx = this.state.selectedStudentIds.indexOf(id);
    if (idx >= 0) this.state.selectedStudentIds.splice(idx, 1);
    else this.state.selectedStudentIds.push(id);
    this._loadLineChartData();
  }

    async _loadLineChartData() {
    const domain = [
        ['project_course_id','=',this.state.selectedProjectId],
        ['group_id','=',this.state.selectedLabelGroupId],
        ['student_id','in', this.state.selectedStudentIds],
    ].filter(d => d[2] != null);

    const data = await this.orm.searchRead(
        'logbook.label.analytics',
        domain,
        ['student_id','student_nim','week_date','total_point','week_id']
    );
    this.state.lineChartData = data;
    // langsung render, karena canvas selalu ada
    this._renderLineChart();
    }






  _renderWeekChart() {
    const canvas = this.barChartRef.el;
    const ctx = canvas.getContext("2d");
    this._destroyChart(this.chart1);

    const byClass = {}, labels = [];
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
      backgroundColor: `hsl(${i * 60 % 360}, 70%, 60%)`,
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
          x: { stacked: false, ticks: { autoSkip: true, maxRotation: 45 }, barThickness: "flex" },
          y: { beginAtZero: true },
        },
      },
    });
  }

  _renderClassChart() {
  const canvas = this.classChartRef.el;
  const ctx = canvas.getContext("2d");
  this._destroyChart(this.chart2);

  const byWeek = {};
  const weekDateMap = new Map();  // untuk menyimpan wk → week_date
  const labels = [];

  for (const r of this.state.classData) {
    const wk = r.week_id?.[1];
    const lbl = r.label_id?.[1];
    const date = r.week_date;

    if (!wk || !lbl) continue;

    // Pemetaan week name → date (untuk sorting)
    if (date && !weekDateMap.has(wk)) {
      weekDateMap.set(wk, date);
    }

    // Agregasi total point per label per week
    byWeek[wk] = byWeek[wk] || {};
    byWeek[wk][lbl] = (byWeek[wk][lbl] || 0) + (r.total_point || 0);

    // Tambahkan ke label unik
    if (!labels.includes(lbl)) labels.push(lbl);
  }

  // Urutkan nama minggu berdasarkan tanggalnya
  const sortedWeeks = [...weekDateMap.entries()]
    .sort((a, b) => new Date(a[1]) - new Date(b[1]))
    .map(([wk]) => wk);

  // Bangun datasets dengan urutan minggu terurut
  const datasets = sortedWeeks.map((wk, i) => ({
    label: wk,
    data: labels.map((l) => byWeek[wk]?.[l] || 0),
    backgroundColor: `hsl(${i * 60 % 360}, 70%, 60%)`,
  }));

  this.chart2 = new window.Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: "Poin per Label (Kelas terpilih)" },
      },
      scales: {
        x: {
          stacked: false,
          ticks: { autoSkip: true, maxRotation: 45 },
          barThickness: "flex",
        },
        y: {
          beginAtZero: true,
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
    const studentLabels = sortedNIMs.map(nim => studentMap.get(nim).name);
    const datasets = Object.keys(byGroup).map((group, idx) => ({
        label: group,
        data: sortedNIMs.map(nim => byGroup[group][nim] || 0),
        backgroundColor: `hsl(${idx * 72 % 360}, 70%, 60%)`,
    }));

    this.chart3 = new window.Chart(ctx, {
        type: "bar",
        data: { labels: studentLabels, datasets },
        options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: "top" },
            title: { display: true, text: "Total Poin per Student by Label Group (sorted by NIM)" },
        },
        scales: {
            x: { stacked: false, ticks: { autoSkip: false, maxRotation: 45 } },
            y: { stacked: false, beginAtZero: true },
        },
        },
    });
  }

_renderLineChart() {
  const canvas = this.lineChartRef.el;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (this.chart4) this.chart4.destroy();

  // 1) Cari semua tanggal unik & week label
  const uniqDates = Array.from(
    new Set(this.state.lineChartData.map(r => r.week_date).filter(Boolean))
  ).sort();
  const weekByDate = {};
  this.state.lineChartData.forEach(r => {
    if (r.week_date && r.week_id) {
      weekByDate[r.week_date] = r.week_id[1];
    }
  });
  const labels = uniqDates.map(d => `${weekByDate[d]||'?'} (${d})`);

  // 2) Kumpulkan poin per mahasiswa per tanggal
  const byStu = {};
  this.state.lineChartData.forEach(r => {
    const nim = r.student_nim, name = r.student_id?.[1]||'Unknown', date = r.week_date;
    if (!nim || !date) return;
    if (!byStu[nim]) byStu[nim] = { label:`${name} (${nim})`, data: {} };
    byStu[nim].data[date] = (byStu[nim].data[date]||0) + r.total_point;
  });

  // 3) Bangun datasets untuk Chart.js
  const datasets = Object.values(byStu).map((stu,i) => ({
    label: stu.label,
    data: labels.map(lbl => {
      const d = lbl.match(/\(([^)]+)\)$/)[1];
      return stu.data[d]||0;
    }),
    borderColor: `hsl(${i*60%360},70%,50%)`,
    fill: false,
    tension: 0.3,
  }));

  // 4) Render dengan category axis
  this.chart4 = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Perkembangan Poin Mahasiswa per Tanggal' },
      },
      scales: {
        x: {
          type: 'category',
          ticks: { autoSkip: false, maxRotation: 45 },
          title: { display: true, text: 'Minggu (Tanggal)' },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Total Poin' },
        },
      },
    },
  });
}


  _destroyChart(chart) {
    if (chart) chart.destroy();
  }
}

LogbookDashboard.template = "jtk_logbook_analytics.LogbookDashboard";
registry.category("actions").add("jtk_logbook_analytics.logbook_dashboard", LogbookDashboard);
