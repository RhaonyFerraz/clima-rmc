/**
 * Módulo do Dashboard Histórico - ClimaRMC
 * Exibe séries temporais do banco de dados SQLite com seletor de período
 */

(function () {
  let chartTemp = null;
  let chartAqi = null;
  let chartPollutants = null;

  let currentCityId = 'campinas';
  let currentHours = 24;

  const PERIOD_OPTIONS = [
    { hours: 24, label: 'Últimas 24h' },
    { hours: 168, label: '7 dias' },
    { hours: 720, label: '30 dias' }
  ];

  const CHART_DEFAULTS = {
    tension: 0.35,
    fill: false,
    borderWidth: 2,
    pointRadius: 3,
    pointHoverRadius: 6,
    spanGaps: true
  };

  /**
   * Inicializa os 3 gráficos históricos com Chart.js
   */
  function initHistoryCharts() {
    const ctxTemp = document.getElementById('chart-history-temp');
    const ctxAqi = document.getElementById('chart-history-aqi');
    const ctxPoll = document.getElementById('chart-history-pollutants');

    if (!ctxTemp || !ctxAqi || !ctxPoll || typeof Chart === 'undefined') return;

    const baseGridConfig = {
      color: 'rgba(148, 163, 184, 0.15)',
      drawBorder: false
    };
    const baseTickConfig = {
      color: '#334155',
      font: { family: 'Inter', size: 11, weight: '500' }
    };

    // Gráfico 1: Temperatura e Sensação Térmica
    chartTemp = new Chart(ctxTemp, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#0f172a', font: { family: 'Inter', size: 12, weight: '600' }, boxWidth: 14 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(148, 163, 184, 0.15)',
            borderWidth: 1
          }
        },
        scales: {
          x: { grid: baseGridConfig, ticks: baseTickConfig },
          temp: {
            type: 'linear',
            position: 'left',
            grid: baseGridConfig,
            ticks: { ...baseTickConfig, callback: v => v + '°C' }
          },
          hum: {
            type: 'linear',
            position: 'right',
            grid: { display: false },
            ticks: { ...baseTickConfig, callback: v => v + '%' },
            min: 0,
            max: 100
          }
        }
      }
    });

    // Gráfico 2: IQAr CONAMA ao longo do tempo
    chartAqi = new Chart(ctxAqi, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#0f172a', font: { family: 'Inter', size: 12, weight: '600' }, boxWidth: 14 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(148, 163, 184, 0.15)',
            borderWidth: 1,
            callbacks: {
              afterLabel: (ctx) => {
                const v = ctx.raw;
                if (v === null) return '';
                if (v <= 40) return '  → Boa';
                if (v <= 80) return '  → Moderada';
                if (v <= 120) return '  → Ruim';
                if (v <= 200) return '  → Muito Ruim';
                return '  → Péssima';
              }
            }
          },
          annotation: {} // Reservado para linhas de referência
        },
        scales: {
          x: { grid: baseGridConfig, ticks: baseTickConfig },
          y: {
            grid: baseGridConfig,
            ticks: baseTickConfig,
            min: 0,
            suggestedMax: 100
          }
        }
      }
    });

    // Gráfico 3: PM2.5 e PM10 históricos
    chartPollutants = new Chart(ctxPoll, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#0f172a', font: { family: 'Inter', size: 12, weight: '600' }, boxWidth: 14 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(148, 163, 184, 0.15)',
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.raw !== null ? ctx.raw + ' µg/m³' : '--'}`
            }
          }
        },
        scales: {
          x: { grid: baseGridConfig, ticks: baseTickConfig, stacked: false },
          y: {
            grid: baseGridConfig,
            ticks: { ...baseTickConfig, callback: v => v + ' µg/m³' },
            min: 0
          }
        }
      }
    });
  }

  /**
   * Busca dados históricos da API e atualiza os gráficos
   */
  async function loadHistoricalData(cityId, hours) {
    currentCityId = cityId;
    currentHours = hours;

    const loadingEl = document.getElementById('history-loading');
    const contentEl = document.getElementById('history-content');
    const emptyEl = document.getElementById('history-empty');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (contentEl) contentEl.style.opacity = '0.4';
    if (emptyEl) emptyEl.style.display = 'none';

    try {
      const res = await fetch(`/api/weather/${cityId}/history?hours=${hours}&limit=200`);
      const json = await res.json();

      if (!json.success || !json.series || json.count === 0) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
        updateHistoryStats(null);
        return;
      }

      const { series, period, count } = json;

      // Atualiza estatísticas de resumo
      updateHistoryStats(series, count, period.label);

      // Gráfico 1: Temperatura + Umidade
      if (chartTemp) {
        chartTemp.data.labels = series.labels;
        chartTemp.data.datasets = [
          {
            label: 'Temperatura (°C)',
            data: series.temperature,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,0.12)',
            yAxisID: 'temp',
            fill: true,
            ...CHART_DEFAULTS
          },
          {
            label: 'Umidade (%)',
            data: series.humidity,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56,189,248,0.08)',
            yAxisID: 'hum',
            borderDash: [5, 3],
            fill: false,
            ...CHART_DEFAULTS,
            pointRadius: 2
          }
        ];
        chartTemp.update('active');
      }

      // Gráfico 2: IQAr com faixas de cores dinâmicas
      if (chartAqi) {
        const iqarColors = (series.iqar || []).map(v => {
          if (v === null) return 'rgba(100,116,139,0.6)';
          if (v <= 40) return 'rgba(16,185,129,0.85)';
          if (v <= 80) return 'rgba(245,158,11,0.85)';
          if (v <= 120) return 'rgba(249,115,22,0.85)';
          if (v <= 200) return 'rgba(239,68,68,0.85)';
          return 'rgba(124,58,237,0.85)';
        });

        chartAqi.data.labels = series.labels;
        chartAqi.data.datasets = [
          {
            label: 'IQAr CONAMA',
            data: series.iqar,
            borderColor: '#a78bfa',
            backgroundColor: iqarColors,
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            spanGaps: true
          }
        ];
        chartAqi.update('active');
      }

      // Gráfico 3: PM2.5 e PM10 em barras
      if (chartPollutants) {
        chartPollutants.data.labels = series.labels;
        chartPollutants.data.datasets = [
          {
            label: 'PM2.5 (µg/m³)',
            data: series.pm2_5,
            backgroundColor: 'rgba(167,139,250,0.75)',
            borderColor: '#a78bfa',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: 'PM10 (µg/m³)',
            data: series.pm10,
            backgroundColor: 'rgba(251,191,36,0.65)',
            borderColor: '#fbbf24',
            borderWidth: 1,
            borderRadius: 3
          }
        ];
        chartPollutants.update('active');
      }

      if (contentEl) contentEl.style.opacity = '1';
    } catch (err) {
      console.error('[HISTORY] Erro ao carregar dados históricos:', err);
      if (emptyEl) emptyEl.style.display = 'flex';
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  /**
   * Atualiza as estatísticas de resumo do período
   */
  function updateHistoryStats(series, count, periodLabel) {
    const el = id => document.getElementById(id);

    if (!series || !count) {
      ['hist-stat-count', 'hist-stat-temp-avg', 'hist-stat-temp-range',
        'hist-stat-hum-avg', 'hist-stat-iqar-avg', 'hist-stat-period'].forEach(id => {
        const e = el(id);
        if (e) e.textContent = '--';
      });
      return;
    }

    const validTemp = series.temperature.filter(v => v !== null);
    const validHum = series.humidity.filter(v => v !== null);
    const validIqar = series.iqar.filter(v => v !== null);

    const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '--';
    const min = arr => arr.length ? Math.min(...arr).toFixed(1) : '--';
    const max = arr => arr.length ? Math.max(...arr).toFixed(1) : '--';

    if (el('hist-stat-count')) el('hist-stat-count').textContent = count + ' leituras';
    if (el('hist-stat-period')) el('hist-stat-period').textContent = periodLabel || '--';
    if (el('hist-stat-temp-avg')) el('hist-stat-temp-avg').textContent = avg(validTemp) + '°C';
    if (el('hist-stat-temp-range')) el('hist-stat-temp-range').textContent = min(validTemp) + '° ~ ' + max(validTemp) + '°';
    if (el('hist-stat-hum-avg')) el('hist-stat-hum-avg').textContent = avg(validHum) + '%';
    if (el('hist-stat-iqar-avg')) el('hist-stat-iqar-avg').textContent = avg(validIqar);
  }

  /**
   * Configura os botões de seleção de período
   */
  function setupPeriodButtons() {
    const btns = document.querySelectorAll('.hist-period-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const hours = parseInt(btn.getAttribute('data-hours'), 10);
        loadHistoricalData(currentCityId, hours);
      });
    });
  }

  /**
   * API pública para que app.js possa atualizar a cidade selecionada
   */
  window.ClimaHistory = {
    init: function () {
      initHistoryCharts();
      setupPeriodButtons();
      // Carrega dados após um pequeno delay para não sobrecarregar o primeiro render
      setTimeout(() => loadHistoricalData('campinas', 24), 800);
    },
    loadCity: function (cityId) {
      loadHistoricalData(cityId, currentHours);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (window.ClimaHistory) window.ClimaHistory.init();
  });
})();
