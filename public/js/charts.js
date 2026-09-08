/**
 * Módulo de Visualização de Dados e Gráficos - ClimaRMC
 * Utiliza a biblioteca Chart.js com suporte a acessibilidade e paleta dinâmica
 */

(function () {
  let weatherChartInstance = null;
  let pollutantsChartInstance = null;
  let comparisonChartInstance = null;

  // Cores limpas e contrastantes para o tema padrão
  const getChartColors = () => {
    return {
      text: '#0f172a',
      grid: '#e2e8f0',
      tempLine: '#0284c7',
      tempFill: 'rgba(2, 132, 199, 0.12)',
      humLine: '#6366f1',
      pm25: '#ea580c',
      pm10: '#d97706'
    };
  };

  /**
   * Renderiza o gráfico de temperatura e umidade horária (24 horas)
   */
  function renderWeatherHourlyChart(forecastData) {
    const ctx = document.getElementById('chart-weather-hourly');
    if (!ctx) return;

    const colors = getChartColors();
    const hours = (forecastData.time || []).map(t => {
      const d = new Date(t);
      return `${String(d.getHours()).padStart(2, '0')}h`;
    });

    if (weatherChartInstance) {
      weatherChartInstance.destroy();
    }

    weatherChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [
          {
            label: 'Temperatura (°C)',
            data: forecastData.temperature || [],
            borderColor: colors.tempLine,
            backgroundColor: colors.tempFill,
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            yAxisID: 'yTemp'
          },
          {
            label: 'Umidade Relativa (%)',
            data: forecastData.humidity || [],
            borderColor: colors.humLine,
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            yAxisID: 'yHum'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            labels: { color: colors.text, font: { family: 'Inter', size: 12, weight: '600' } }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: { color: colors.text, maxTicksLimit: 12 }
          },
          yTemp: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Temperatura (°C)', color: colors.text },
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          },
          yHum: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Umidade (%)', color: colors.text },
            grid: { drawOnChartArea: false },
            ticks: { color: colors.text },
            min: 0,
            max: 100
          }
        }
      }
    });
  }

  /**
   * Renderiza gráfico de partículas finas (PM2.5 e PM10)
   */
  function renderPollutantsChart(forecastAir) {
    const ctx = document.getElementById('chart-pollutants');
    if (!ctx) return;

    const colors = getChartColors();
    const hours = (forecastAir.time || []).map(t => {
      const d = new Date(t);
      return `${String(d.getHours()).padStart(2, '0')}h`;
    });

    if (pollutantsChartInstance) {
      pollutantsChartInstance.destroy();
    }

    pollutantsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: hours,
        datasets: [
          {
            label: 'PM2.5 (µg/m³ - Fino)',
            data: forecastAir.pm2_5 || [],
            backgroundColor: colors.pm25,
            borderRadius: 4
          },
          {
            label: 'PM10 (µg/m³ - Inalável)',
            data: forecastAir.pm10 || [],
            backgroundColor: colors.pm10,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: colors.text, font: { family: 'Inter', size: 12, weight: '600' } }
          }
        },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: { color: colors.text, maxTicksLimit: 12 }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.text },
            title: { display: true, text: 'Concentração (µg/m³)', color: colors.text },
            beginAtZero: true
          }
        }
      }
    });
  }

  /**
   * Renderiza gráfico comparativo das 3 cidades da RMC
   */
  function renderRmcComparisonChart(citiesData) {
    const ctx = document.getElementById('chart-rmc-comparison');
    if (!ctx || !citiesData || citiesData.length === 0) return;

    const colors = getChartColors();
    const labels = citiesData.map(c => c.city.name);
    const temps = citiesData.map(c => c.weather.temperature);
    const hums = citiesData.map(c => c.weather.humidity);
    const iqars = citiesData.map(c => c.airQuality.iqarConama);

    if (comparisonChartInstance) {
      comparisonChartInstance.destroy();
    }

    comparisonChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Temperatura (°C)',
            data: temps,
            backgroundColor: '#38bdf8',
            borderRadius: 6
          },
          {
            label: 'Umidade (%)',
            data: hums,
            backgroundColor: '#818cf8',
            borderRadius: 6
          },
          {
            label: 'Índice IQAr CONAMA',
            data: iqars,
            backgroundColor: '#f59e0b',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: colors.text, font: { family: 'Inter', size: 12, weight: '600' } }
          }
        },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.text },
            beginAtZero: true
          }
        }
      }
    });
  }

  window.ClimaCharts = {
    renderWeatherHourlyChart,
    renderPollutantsChart,
    renderRmcComparisonChart
  };
})();
