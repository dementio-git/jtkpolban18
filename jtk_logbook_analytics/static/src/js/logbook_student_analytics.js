import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";
import * as echarts from "echarts";

// fungsi dari langkah 1
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
    this.state = useState({
      students: [],
      components: {},
    });

    onWillStart(async () => {
      const projectCourseId = getRecordIdFromPath();
      if (!projectCourseId) {
        console.warn("❌ Tidak dapat mengambil project_course_id dari URL");
        return;
      }

      const res = await rpc("/logbook/clustering/label", {
        project_course_id: projectCourseId,
      });

      this.state.students = res.students;
      this.state.components = res.components_info;
    });

    onMounted(() => {
      setTimeout(() => this.renderChart(), 0);
    });
  }

  renderChart() {
    const container = document.getElementById("chart");
    if (!container) return;
    const chart = echarts.init(container);

    const scatterData = this.state.students.map((s) => ({
      name: s.student_name, // ← penting agar masuk ke legend
      value: [s.x, s.y],
      cluster: s.cluster,
    }));

    chart.setOption({
      title: {
        text: "Clustering Mahasiswa Berdasarkan Label Terpilih",
        left: "center",
      },
      tooltip: {
        trigger: "item",
        formatter: ({ data }) =>
          `Mahasiswa: ${data.name}<br/>Cluster: ${data.cluster}
       <br/>X: ${data.value[0].toFixed(2)}
       <br/>Y: ${data.value[1].toFixed(2)}`,
      },
      legend: {
        type: "scroll",
        orient: "vertical",
        right: 0,
        top: 60,
        selectedMode: "multiple",
        tooltip: { show: true },
      },
      xAxis: {
        name: this.state.components.x_axis_name || "X-Axis",
        scale: true,
      },
      yAxis: {
        name: this.state.components.y_axis_name || "Y-Axis",
        scale: true,
      },
      series: this.state.students.map((s) => ({
        name: s.student_name,
        type: "scatter",
        data: [
          {
            name: s.student_name,
            value: [s.x, s.y],
            cluster: s.cluster,
          },
        ],
        itemStyle: { color: this.getColor(s.cluster) },
        emphasis: {
          focus: "series",
          blurScope: "coordinateSystem",
        },
      })),
    });
  }

  getColor(cluster) {
    const colors = ["#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE"];
    return colors[cluster % colors.length];
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
