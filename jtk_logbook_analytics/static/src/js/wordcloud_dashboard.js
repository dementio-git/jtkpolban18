/** @odoo-module **/

import { Component, onWillStart, onMounted, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class WordCloudDashboard extends Component {
    setup() {
        this.orm = useService("orm");
        this.state = useState({
            projects: [],
            weeks: [],
            classes: [],
            selectedProjectId: null,
            selectedWeekId: null,
            selectedClassId: null,
            data: [],
        });
        onWillStart(async () => {
            this.state.projects = await this.orm.searchRead("project.course", [], ["name"]);
        });

        onMounted(() => this.renderChart());
    }

    async onProjectChange(ev) {
        const projectId = parseInt(ev.target.value) || null;
        this.state.selectedProjectId = projectId;
        this.state.selectedWeekId = null;
        this.state.selectedClassId = null;
        this.state.weeks = [];
        this.state.classes = [];
        this.state.data = [];

        if (!projectId) return;

        this.state.weeks = await this.orm.searchRead(
            "week.line",
            [["course_id", "=", projectId]],
            ["name"]
        );

        const [project] = await this.orm.read("project.course", [projectId], ["class_ids"]);
        if (project.class_ids.length) {
            const classRecs = await this.orm.read("class.class", project.class_ids, ["name"]);
            this.state.classes = classRecs.map((cls) => ({ id: cls.id, name: cls.name }));
        }
    }
    onClassChange(ev) {
        this.state.selectedClassId = parseInt(ev.target.value) || null;
        // Langsung refresh data jika minggu sudah dipilih
        if (this.state.selectedWeekId) {
            this.onWeekChange({ target: { value: this.state.selectedWeekId } });
        }
    }

    async onWeekChange(ev) {
        const weekId = parseInt(ev.target.value) || null;
        this.state.selectedWeekId = weekId;
        this.state.data = [];

        if (!this.state.selectedProjectId || !weekId) return;

        // 1. Ambil semua logbook dari minggu & project yang dipilih
        const logbooks = await this.orm.searchRead(
            "logbook.logbook",
            [
                ["week_id", "=", weekId],
                ["project_course_id", "=", this.state.selectedProjectId],
            ],
            ["logbook_keyword_ids"]
        );

        // 2. Ambil semua keyword dari semua logbook
        const keyword_ids = logbooks.flatMap((l) => l.logbook_keyword_ids);
        if (!keyword_ids.length) return;

        const keywords = await this.orm.read("logbook.keyword", keyword_ids, ["name"]);

        // 3. Hitung frekuensi kata
        const freq = {};
        for (const k of keywords) {
            if (!k.name) continue;
            const name = k.name.trim();
            if (!name) continue;
            freq[name] = (freq[name] || 0) + 1;
        }

        // 4. Siapkan data untuk wordcloud
        this.state.data = Object.entries(freq)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 200);

        this.renderChart();
    }

    renderChart() {
        const dom = document.getElementById("wordcloud_chart");
        if (!dom) return;

        this.chart?.dispose?.();
        this.chart = echarts.init(dom);

        try {
            this.chart.setOption({
                tooltip: {},
                series: [{
                    type: "wordCloud",
                    gridSize: 8,
                    sizeRange: [12, 40],
                    rotationRange: [-45, 90],
                    shape: "circle",
                    textStyle: {
                        color: () => `hsl(${Math.random() * 360}, 70%, 50%)`,
                    },
                    data: this.state.data,
                }],
            });
        } catch (err) {
            console.error("❌ Failed to render word cloud:", err);
        }
    }
}

WordCloudDashboard.template = "jtk_logbook_analytics.WordCloudDashboard";
registry.category("actions").add("jtk_logbook_analytics.logbook_wordcloud_dashboard", WordCloudDashboard);
