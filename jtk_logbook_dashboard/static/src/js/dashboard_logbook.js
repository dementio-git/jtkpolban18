// File: static/src/js/dashboard_logbook.js
import { registry } from '@web/core/registry';
import { Component, onMounted } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { loadJS } from '@web/core/assets';

export class DashboardLogbook extends Component {
  setup() {
    this.orm = useService('orm');
    onMounted(async () => {
      await loadJS("https://cdn.jsdelivr.net/npm/chart.js");
      this.renderProjectChart();
    });
  }

  async fetchData(endpoint) {
    const response = await fetch(endpoint, { method: 'POST' });
    return await response.json();
  }

  async renderProjectChart() {
    const data = await this.fetchData('/dashboard_logbook/project');
    const ctx = this.el.querySelector('#projectChart').getContext('2d');
    if (this.projectChart) this.projectChart.destroy();
    this.projectChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{ label: 'Jumlah', data: data.map(d => d.count), backgroundColor: '#36a2eb' }],
      },
      options: {
        onClick: async (e, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const selected = data[index];
            this.currentProjectId = selected.id;
            this.renderClassChart();
          }
        },
      },
    });
  }

  async renderClassChart() {
    const data = await this.fetchData(`/dashboard_logbook/class/${this.currentProjectId}`);
    const ctx = this.el.querySelector('#classChart').getContext('2d');
    if (this.classChart) this.classChart.destroy();
    this.classChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{ label: 'Jumlah', data: data.map(d => d.count), backgroundColor: '#ff6384' }],
      },
      options: {
        onClick: async (e, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const selected = data[index];
            this.currentClassId = selected.id;
            this.renderLabelChart();
          }
        },
      },
    });
  }

  async renderLabelChart() {
    const data = await this.fetchData(`/dashboard_logbook/label/${this.currentProjectId}/${this.currentClassId}`);
    const ctx = this.el.querySelector('#labelChart').getContext('2d');
    if (this.labelChart) this.labelChart.destroy();
    this.labelChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{ label: 'Jumlah', data: data.map(d => d.count), backgroundColor: '#4bc0c0' }],
      },
    });
  }
}

DashboardLogbook.template = 'dashboard_logbook_template';
registry.category('actions').add('dashboard_logbook.client_action', DashboardLogbook);
