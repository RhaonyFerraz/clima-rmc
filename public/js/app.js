/**
 * Controlador Principal da Interface - ClimaRMC
 * Gerencia requisições assíncronas, manipulação de DOM e eventos
 */

(function () {
  let currentCityId = 'campinas';
  let allCitiesCache = [];

  async function initApp() {
    setupCityTabs();
    setupSyncButton();
    setupExportButtons();

    // Carrega dados iniciais
    await loadAllCitiesSummary();
    await selectCity(currentCityId);
    await loadDataAnalysis();
  }

  /**
   * Configura os botões de alternância de cidade
   */
  function setupCityTabs() {
    const tabs = document.querySelectorAll('.city-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const cityId = e.target.getAttribute('data-city');
        if (cityId && cityId !== currentCityId) {
          tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
          selectCity(cityId);
        }
      });
    });
  }

  /**
   * Configura o botão de sincronização em tempo real
   */
  function setupSyncButton() {
    const syncBtn = document.getElementById('btn-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.classList.add('loading');
        syncBtn.setAttribute('disabled', 'true');
        if (window.A11y) window.A11y.announce('Atualizando dados climáticos e qualidade do ar em tempo real...');

        try {
          // Dispara sincronização no backend
          await fetch('/api/weather/sync', { method: 'POST' });
          await loadAllCitiesSummary();
          await selectCity(currentCityId);
          await loadDataAnalysis();

          if (window.A11y) window.A11y.announce('Dados meteorológicos atualizados com sucesso!');
        } catch (err) {
          console.error('Erro na sincronização:', err);
        } finally {
          syncBtn.classList.remove('loading');
          syncBtn.removeAttribute('disabled');
        }
      });
    }
  }

  /**
   * Configura links de exportação com base na cidade selecionada
   */
  function setupExportButtons() {
    const csvBtn = document.getElementById('btn-export-csv');
    const jsonBtn = document.getElementById('btn-export-json');

    if (csvBtn) {
      csvBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/api/export?format=csv&cityId=${currentCityId}`;
      });
    }

    if (jsonBtn) {
      jsonBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/api/export?format=json&cityId=${currentCityId}`;
      });
    }
  }

  /**
   * Consulta o resumo de todas as cidades para gráficos comparativos
   */
  async function loadAllCitiesSummary() {
    try {
      const res = await fetch('/api/weather/all/summary');
      const json = await res.json();
      if (json.success && json.data) {
        allCitiesCache = json.data;
        if (window.ClimaCharts) {
          window.ClimaCharts.renderRmcComparisonChart(allCitiesCache);
        }
        if (window.RmcMap) {
          window.RmcMap.updateMarkers(allCitiesCache);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar resumo da RMC:', err);
    }
  }

  /**
   * Seleciona e carrega os detalhes completos de uma cidade específica
   */
  async function selectCity(cityId) {
    currentCityId = cityId;
    try {
      if (window.RmcMap) {
        window.RmcMap.highlightCity(cityId);
      }

      const res = await fetch(`/api/weather/${cityId}`);
      const json = await res.json();

      if (json.success && json.data) {
        renderCityDashboard(json.data);
      }
    } catch (err) {
      console.error(`Erro ao carregar dados de ${cityId}:`, err);
    }
  }

  /**
   * Renderiza os dados climáticos e de poluição nos cartões do painel
   */
  function renderCityDashboard(data) {
    const { city, weather, airQuality, alerts } = data;

    // Atualiza nome da cidade nos títulos
    const cityNameEls = document.querySelectorAll('.dynamic-city-name');
    cityNameEls.forEach(el => el.textContent = city.name);

    // 1. Alertas Ativos
    renderAlerts(alerts, city.name);

    // 2. Card de Clima
    document.getElementById('weather-temp').textContent = Math.round(weather.temperature);
    document.getElementById('weather-apparent').textContent = `${weather.apparentTemperature?.toFixed(1)}°C`;
    document.getElementById('weather-condition').textContent = weather.condition;
    document.getElementById('weather-icon').textContent = weather.icon;
    document.getElementById('weather-humidity').textContent = `${weather.humidity}%`;
    document.getElementById('weather-wind').textContent = `${weather.windSpeed} km/h`;
    document.getElementById('weather-pressure').textContent = `${weather.surfacePressure} hPa`;
    document.getElementById('weather-precip').textContent = `${weather.precipitation} mm`;

    // 3. Card de Qualidade do Ar
    const aqiScoreEl = document.getElementById('aqi-score');
    const aqiPillEl = document.getElementById('aqi-status-pill');
    aqiScoreEl.textContent = airQuality.iqarConama;
    aqiScoreEl.style.color = airQuality.color;

    aqiPillEl.textContent = airQuality.category;
    aqiPillEl.style.backgroundColor = airQuality.color;

    // Atualiza ponteiro visual da barra de risco CONAMA
    const pointerEl = document.getElementById('aqi-meter-pointer');
    if (pointerEl) {
      let percentage = 10;
      const val = airQuality.iqarConama || 0;
      if (val <= 40) {
        percentage = (val / 40) * 20;
      } else if (val <= 80) {
        percentage = 20 + ((val - 40) / 40) * 20;
      } else if (val <= 120) {
        percentage = 40 + ((val - 80) / 40) * 20;
      } else if (val <= 200) {
        percentage = 60 + ((val - 120) / 80) * 25;
      } else {
        percentage = Math.min(98, 85 + ((val - 200) / 100) * 13);
      }
      pointerEl.style.left = `${Math.max(2, Math.min(98, percentage))}%`;
    }

    document.getElementById('aqi-recommendation-text').textContent = airQuality.recommendation;
    document.getElementById('val-pm25').textContent = `${airQuality.pm2_5 ?? '--'} µg/m³`;
    document.getElementById('val-pm10').textContent = `${airQuality.pm10 ?? '--'} µg/m³`;
    document.getElementById('val-ozone').textContent = `${airQuality.ozone ?? '--'} µg/m³`;
    document.getElementById('val-no2').textContent = `${airQuality.nitrogenDioxide ?? '--'} µg/m³`;
    document.getElementById('val-so2').textContent = `${airQuality.sulphurDioxide ?? '--'} µg/m³`;
    document.getElementById('val-co').textContent = `${airQuality.carbonMonoxide ?? '--'} µg/m³`;

    // 4. Card de Informações da Cidade
    document.getElementById('city-description').textContent = city.description;
    document.getElementById('city-population').textContent = city.population ? city.population.toLocaleString('pt-BR') : '--';
    document.getElementById('city-elevation').textContent = `${city.elevation}m`;
    document.getElementById('city-coords').textContent = `${city.latitude}, ${city.longitude}`;

    // 5. Gráficos específicos da cidade
    if (window.ClimaCharts) {
      if (weather.forecastHourly) {
        window.ClimaCharts.renderWeatherHourlyChart(weather.forecastHourly);
      }
      if (airQuality.forecastHourly) {
        window.ClimaCharts.renderPollutantsChart(airQuality.forecastHourly);
      }
    }

    if (window.A11y) {
      window.A11y.announce(`Dados de ${city.name} carregados: Temperatura de ${Math.round(weather.temperature)} graus e qualidade do ar ${airQuality.category}.`);
    }
  }

  /**
   * Renderiza a lista de alertas
   */
  function renderAlerts(alerts, cityName) {
    const container = document.getElementById('alerts-container');
    if (!container) return;

    container.innerHTML = '';

    if (!alerts || alerts.length === 0) {
      container.innerHTML = `
        <div class="alert-card warning" style="background: rgba(16, 185, 129, 0.1); border-color: #10b981; color: #6ee7b7;">
          <span class="alert-icon" aria-hidden="true">✅</span>
          <div class="alert-content">
            <h3>Condições Estáveis</h3>
            <p>Nenhum alerta meteorológico ou de emergência emitido no momento para ${cityName}.</p>
          </div>
        </div>
      `;
      return;
    }

    alerts.forEach(alert => {
      const card = document.createElement('div');
      const isDanger = alert.severity === 'DANGER';
      card.className = `alert-card ${isDanger ? 'danger' : 'warning'}`;
      card.setAttribute('role', 'alert');

      card.innerHTML = `
        <span class="alert-icon" aria-hidden="true">${isDanger ? '🚨' : '⚠️'}</span>
        <div class="alert-content">
          <h3>${alert.title}</h3>
          <p>${alert.message}</p>
        </div>
      `;
      container.appendChild(card);
    });
  }

  /**
   * Carrega a análise estatística de dados das 3 cidades
   */
  async function loadDataAnalysis() {
    try {
      const res = await fetch('/api/analysis');
      const json = await res.json();

      if (json.success && json.data) {
        const { citiesSummary, statisticalInsights } = json.data;

        // Atualiza interpretação da correlação
        const corrEl = document.getElementById('correlation-val');
        const corrTextEl = document.getElementById('correlation-text');
        if (corrEl) corrEl.textContent = `r = ${statisticalInsights.correlationHumidityVsPm25}`;
        if (corrTextEl) corrTextEl.textContent = statisticalInsights.interpretation;

        // Popula a tabela analítica
        const tbody = document.getElementById('analysis-tbody');
        if (tbody && citiesSummary) {
          tbody.innerHTML = '';
          citiesSummary.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${c.cityName}</strong></td>
              <td>${c.metrics.temperature.avg}°C (${c.metrics.temperature.min}°C a ${c.metrics.temperature.max}°C)</td>
              <td>${c.metrics.humidity.avg}% (${c.metrics.humidity.min}% a ${c.metrics.humidity.max}%)</td>
              <td>${c.metrics.pm2_5.avg} µg/m³</td>
              <td>${c.metrics.pm10.avg} µg/m³</td>
              <td><strong>${c.metrics.conamaIqar.avg}</strong></td>
              <td>${c.readingsCount} amostras</td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
    } catch (err) {
      console.error('Erro ao carregar análise de dados:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
