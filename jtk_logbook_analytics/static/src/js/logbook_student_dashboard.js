/** @odoo-module **/
import { Component, useRef, useState, onWillStart, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

async function nextTick () {
    await new Promise(r => requestAnimationFrame(r));
}

function getColor(index) {
    const vibrant = [
        "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
        "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
        "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
        "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
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
        labelGroupMap: {}
    });

    this.lineChartRef = useRef("lineChartRef");


    onWillStart(async () => {
        this.state.projects = await this.orm.searchRead("project.course", [], ["name"]);
    });

    useEffect(() => {
        if (Object.keys(this.state.multiChartData).length > 0) {
            this._renderAllCharts();
        }
    }, () => [JSON.stringify(this.state.multiChartData)]);
  }

  setDynamicRef(gid, el) {
    if (el)       this.dynamicRefs[gid] = el;   // mount
    else          delete this.dynamicRefs[gid]; // un-mount (opsional)
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
    ];
    
    if (this.state.selectedStudentIds.length) {
        domain.push(["student_id", "in", this.state.selectedStudentIds]);
    }

    console.log("Loading data with domain:", domain);

    try {
        const data = await this.orm.searchRead(
            "logbook.label.analytics",
            domain,
            ["student_id", "student_nim", "week_date", "total_point", "week_id", "group_id"]
        );

        const byGroup = {};
        const mapName = {};
        
        for (const r of data) {
            if (!r.group_id) continue;
            const [gid, gname] = r.group_id;
            
            byGroup[gid] = byGroup[gid] || [];
            byGroup[gid].push(r);
            mapName[gid] = gname;
        }

        console.log("Processed chart data:", {byGroup, mapName});
        
        this.state.multiChartData = byGroup;
        this.state.labelGroupMap = mapName;

    } catch (error) {
        console.error("Error loading chart data:", error);
        this.state.multiChartData = {};
        this.state.labelGroupMap = {};
    }
}


  async _renderAllCharts() {
    await nextTick();
    
    // Safely destroy existing charts
    if (this.charts) {
        Object.values(this.charts).forEach(chart => chart?.destroy());
        this.charts = {};
    }

    console.log("MultiChartData:", this.state.multiChartData);
    
    for (const [gid, records] of Object.entries(this.state.multiChartData)) {
        if (!records?.length) continue;

        const canvas = document.getElementById(`chart_${gid}`);
        if (!canvas) {
            console.warn(`Canvas not found for group ${gid}`);
            continue;
        }

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            const chartData = this._prepareChartData(records);
            
            this.charts[gid] = new Chart(ctx, {
                type: "line",
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 300 },
                    plugins: {
                        legend: { 
                            position: "top",
                            labels: { 
                              font: {
                                size: 9 // ← kecilkan font label
                              },
                              boxWidth: 10, 
                              padding: 6 }
                        },
                        title: {
                            display: true,
                            text: this.state.labelGroupMap[gid] || "Chart"
                        }
                    }
                }
            });
        } catch (error) {
            console.error(`Error creating chart ${gid}:`, error);
        }
    }
}

  // Tambahkan lifecycle hook untuk cleanup
  willUnmount() {
      // Destroy all charts when component unmounts
      for (const chart of Object.values(this.charts)) {
          if (chart) chart.destroy();
      }
      this.charts = {};
  }

_prepareChartData(records) {
    // Helper untuk menyiapkan data chart
    const uniqDates = [...new Set(records.map(r => r.week_date))].sort();
    const byStudent = {};
    
    records.forEach(r => {
        const nim = r.student_nim;
        const name = r.student_id?.[1] || "Unknown";
        if (!byStudent[nim]) {
            byStudent[nim] = {
                label: `${name} (${nim})`,
                data: {},
                borderColor: getColor(nim),
                fill: false,
                tension: 0.3
            };
        }
        byStudent[nim].data[r.week_date] = r.total_point;
    });

    return {
        labels: uniqDates,
        datasets: Object.values(byStudent).map(student => ({
            ...student,
            data: uniqDates.map(date => student.data[date] || 0)
        }))
    };
}


  _destroyChart(chart) {
    if (chart) chart.destroy();
  }
}

LogbookStudentDashboard.template = "jtk_logbook_analytics.LogbookStudentDashboard";
registry.category("actions").add("jtk_logbook_analytics.logbook_student_dashboard", LogbookStudentDashboard);
