/** @odoo-module **/
import { Component, useRef, useState, onWillStart, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

async function nextTick() {
  await new Promise((r) => requestAnimationFrame(r));
}

function getColor(index) {
  const vibrant = [
    "#e6194b",
    "#3cb44b",
    "#ffe119",
    "#4363d8",
    "#f58231",
    "#911eb4",
    "#46f0f0",
    "#f032e6",
    "#bcf60c",
    "#fabebe",
    "#008080",
    "#e6beff",
    "#9a6324",
    "#fffac8",
    "#800000",
    "#aaffc3",
    "#808000",
    "#ffd8b1",
    "#000075",
    "#808080",
  ];
  if (index < vibrant.length) return vibrant[index];
  // fallback ke HSL jika sudah lebih dari 20
  const hue = (index * 123) % 360;
  return `hsl(${hue}, 90%, 45%)`;
}

export class LogbookStudentDashboard extends Component {
  setup() {
    this.orm = useService("orm");
    this.charts = {};
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
      multiChartData: {},
      labelGroupMap: {},
    });

    this.lineChartRef = useRef("lineChartRef");

    onWillStart(async () => {
      this.state.projects = await this.orm.searchRead(
        "project.course",
        [],
        ["name"]
      );
    });

    useEffect(
      () => {
        if (Object.keys(this.state.multiChartData).length > 0) {
          this._renderAllCharts();
        }
      },
      () => [JSON.stringify(this.state.multiChartData)]
    );
  }

  setDynamicRef(gid, el) {
    if (el) this.dynamicRefs[gid] = el; // mount
    else delete this.dynamicRefs[gid]; // un-mount (opsional)
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
    const [project] = await this.orm.read(
      "project.course",
      [pid],
      ["class_ids", "logbook_label_ids"]
    );

    if (project.class_ids?.length) {
      const classRecs = await this.orm.read("class.class", project.class_ids, [
        "name",
      ]);
      this.state.classes = classRecs.map((c) => ({ id: c.id, name: c.name }));
    }

    // Ambil semua group dari label
    const labelIds = project.logbook_label_ids || [];
    if (labelIds.length > 0) {
      const labels = await this.orm.read("logbook.label", labelIds, [
        "group_id",
      ]);
      const groupIds = [
        ...new Set(labels.map((l) => l.group_id?.[0]).filter(Boolean)),
      ];
      if (groupIds.length > 0) {
        this.state.labelGroups = await this.orm.read(
          "logbook.label.group",
          groupIds,
          ["name"]
        );
      }
    }

    await this._loadAllStudents(); // Awal kosong atau semua
  }

  async _loadAllStudents() {
    const domain = [];
    if (this.state.selectedStudentClassId) {
      domain.push(["class_id", "=", this.state.selectedStudentClassId]);
    }
    this.state.students = await this.orm.searchRead("student.student", domain, [
      "name",
      "nim",
    ]);
  }

  async onLabelGroupChange(ev) {
    const gid = parseInt(ev.target.value) || null;
    this.state.selectedLabelGroupId = gid;
    await this._loadLineChartData();
  }

  async onStudentClassChange(ev) {
    const cid = parseInt(ev.target.value) || null;
    this.state.selectedStudentClassId = cid;
    await this._loadAllStudents(); // akan di-filter berdasarkan selectedStudentClassId
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
    const domain = [["project_course_id", "=", this.state.selectedProjectId]];
    if (this.state.selectedStudentIds.length) {
      domain.push(["student_id", "in", this.state.selectedStudentIds]);
    } else {
      // Ambil data minggu saja, bukan data label
      const weeks = await this.orm.searchRead(
        "logbook.label.analytics",
        [["project_course_id", "=", this.state.selectedProjectId]],
        ["week_id", "week_date", "group_id"]
      );

      const weekMap = new Map();
      const byGroup = {};
      const mapName = {};

      for (const r of weeks) {
        const weekName = r.week_id?.[1];
        const date = r.week_date;
        const [gid, gname] = r.group_id || [];

        if (weekName && date) weekMap.set(weekName, date);
        if (gid && gname) {
          mapName[gid] = gname;
          byGroup[gid] = []; // kosong, tapi harus tetap dibuat
        }
      }

      this.state.uniqX = [...weekMap.entries()]
        .sort((a, b) => new Date(a[1]) - new Date(b[1]))
        .map(([name]) => name);

      this.state.multiChartData = byGroup;
      this.state.labelGroupMap = mapName;
      return; // langsung keluar, tidak lanjut ambil data
    }

    const data = await this.orm.searchRead("logbook.label.analytics", domain, [
      "student_id",
      "student_nim",
      "week_id",
      "week_date", // penting → week_date untuk urutan
      "total_point",
      "group_id",
    ]);

    const weekMap = new Map(); // { "W1" => 2024-02-05, … }
    data.forEach((rec) => {
      const name = rec.week_id?.[1];
      const date = rec.week_date;
      if (name && date) weekMap.set(name, date);
    });
    this.state.uniqX = [...weekMap.entries()]
      .sort((a, b) => new Date(a[1]) - new Date(b[1]))
      .map(([name]) => name); // ["W1","W2", …]

    const byGroup = {};
    const mapName = {};
    data.forEach((rec) => {
      if (!rec.group_id) return;
      const [gid, gname] = rec.group_id;
      (byGroup[gid] = byGroup[gid] || []).push(rec);
      mapName[gid] = gname;
    });

    this.state.multiChartData = byGroup;
    this.state.labelGroupMap = mapName;
  }

  async _renderAllCharts() {
    await nextTick();

    // Destroy existing ECharts instances
    if (this.charts) {
      Object.values(this.charts).forEach((chart) => chart?.dispose?.());
      this.charts = {};
    }

    for (const [gid, records] of Object.entries(this.state.multiChartData)) {
      // if (!records?.length) continue;

      const dom = document.getElementById(`chart_${gid}`);
      if (!dom) {
        console.warn(`DOM not found for chart_${gid}`);
        continue;
      }

      const chartData = this._prepareChartData(records);
      const option = {
        tooltip: { trigger: "item", confine: true },
        emphasis: { focus: "series" },

        legend: {
          type: "scroll",
          orient: "vertical",
          right: 10,
          top: 20,
          bottom: 20,
          itemWidth: 8,
          itemHeight: 10,
          pageIconSize: 12,
          textStyle: {
            fontSize: 8,
          },
          data: chartData.datasets.map((ds) => ds.label),
        },
        grid: {
          left: "3%",
          right: "28%", // ← tambahkan ruang untuk legend
          bottom: "3%",
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: chartData.labels,
          axisLabel: { fontSize: 10 },
        },
        yAxis: {
          type: "value",
        },
        series: chartData.datasets.map((ds) => ({
          name: ds.label,
          type: "line",
          smooth: true,
          data: ds.data,
          lineStyle: {
            color: ds.borderColor,
          },
          itemStyle: {
            color: ds.borderColor,
          },
        })),
      };

      try {
        const chartInstance = echarts.init(dom);
        chartInstance.setOption(option);
        this.charts[gid] = chartInstance;
      } catch (e) {
        console.error(`ECharts error for group ${gid}:`, e);
      }
    }
  }

  // Tambahkan lifecycle hook untuk cleanup
  willUnmount() {
    // Destroy all charts when component unmounts
    for (const chart of Object.values(this.charts)) {
      if (chart) chart.dispose();
    }
    this.charts = {};
  }

  _prepareChartData(records) {
    // Selalu pakai urutan global yg sudah benar
    const uniqWeeks = this.state.uniqX || [];

    const byStudent = {};
    records.forEach((r) => {
      const weekName = r.week_id?.[1];
      if (!weekName) return;
      const nim = r.student_nim;
      const label = `${r.student_id?.[1] || "Unknown"} (${nim})`;

      byStudent[nim] ??= {
        label,
        data: {},
        borderColor: getColor(nim),
        fill: false,
        tension: 0.3,
      };
      byStudent[nim].data[weekName] = r.total_point;
    });

    return {
      labels: uniqWeeks,
      datasets: Object.values(byStudent).map((stu) => ({
        ...stu,
        data: uniqWeeks.map((w) => stu.data[w] ?? 0),
      })),
    };
  }

  _destroyChart(chart) {
    if (chart) chart.dispose();
  }
}

LogbookStudentDashboard.template =
  "jtk_logbook_analytics.LogbookStudentDashboard";
registry
  .category("actions")
  .add(
    "jtk_logbook_analytics.logbook_student_dashboard",
    LogbookStudentDashboard
  );
