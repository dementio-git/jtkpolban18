/** @odoo-module **/

import { Component, useRef, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { useEffect} from "@odoo/owl";


export class LogbookDashboard extends Component {
    setup() {
        this.orm = useService("orm");
        this.state = useState({ data: [] });
        this.barChartRef = useRef("barChartRef");

        onWillStart(async () => {
            this.state.data = await this.orm.searchRead(
                "logbook.label.analytics",
                [],
                ["label_id", "week_id", "count"]
            );
            console.log("📦 Data Loaded:", this.state.data);
        });

        useEffect(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    console.log("Canvas Ref:", this.barChartRef.el);

                    if (!this.barChartRef.el || this.state.data.length === 0) {
                        console.warn("⛔ Chart skipped: not fully ready");
                        return;
                    }

                    if (typeof window.Chart === "undefined") {
                        console.error("❌ Chart.js is not loaded.");
                        return;
                    }

                    console.log("🟢 Chart.js loaded:", typeof window.Chart);
                    this.renderBarChart();
                });
            });
        }, () => [this.state.data]);




    }

    renderBarChart() {
        console.log("🎯 Rendering chart...");
        console.log("Canvas Ref:", this.barChartRef.el);

        const dataByWeek = {};
        for (const row of this.state.data) {
            const week = row.week_id?.[1] || "Unknown";
            const label = row.label_id?.[1] || "Unknown";

            if (!dataByWeek[week]) dataByWeek[week] = {};
            if (!dataByWeek[week][label]) dataByWeek[week][label] = 0;
            dataByWeek[week][label] += row.count;
        }

        const labels = [...new Set(this.state.data.map(r => r.label_id?.[1]))];
        const weeks = Object.keys(dataByWeek);

        const datasets = weeks.map((week, idx) => ({
            label: week,
            data: labels.map(label => dataByWeek[week][label] || 0),
            backgroundColor: `hsl(${(idx * 60) % 360}, 70%, 60%)`
        }));

        console.log("✅ Labels:", labels);
        console.log("✅ Datasets:", datasets);

        const ctx = this.barChartRef.el.getContext("2d");
        new window.Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: datasets,
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Frekuensi Label per Minggu' }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                }
            }
        });
    }
}

LogbookDashboard.template = "jtk_logbook_analytics.LogbookDashboard";
registry.category("actions").add("jtk_logbook_analytics.logbook_dashboard", LogbookDashboard);
