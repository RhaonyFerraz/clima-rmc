/**
 * Controlador Principal da Interface - ClimaRMC
 * Gerencia requisições assíncronas, manipulação de DOM e eventos
 */

(function () {
  let currentCityId = 'campinas';
  let allCitiesCache = [];
  let campinasDataCache = null;

  async function initApp() {
    setupCityTabs();
    setupSyncButton();
    setupExportButtons();

    if (window.DynamicWeather) {
      window.DynamicWeather.setupNotificationButton(() => campinasDataCache);
    }

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
    const pdfBtn = document.getElementById('btn-export-pdf');
    const csvBtn = document.getElementById('btn-export-csv');
    const jsonBtn = document.getElementById('btn-export-json');

    if (pdfBtn) {
      pdfBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.ReportPdf) {
          window.ReportPdf.generateTechnicalReport(currentCityId);
        }
      });
    }

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
        if (cityId === 'campinas') {
          campinasDataCache = json.data;
          if (window.DynamicWeather) {
            window.DynamicWeather.updateFromCampinas(json.data);
          }
        }
        renderCityDashboard(json.data);

        // Atualiza o Dashboard Histórico para a cidade selecionada
        if (window.ClimaHistory) {
          window.ClimaHistory.loadCity(cityId);
        }
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

    function safeSetText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    // 1. Alertas Ativos
    renderAlerts(alerts, city.name);

    // 2. Card de Clima
    safeSetText('weather-temp', (weather.temperature !== undefined && weather.temperature !== null) ? Math.round(weather.temperature) : '--');
    safeSetText('weather-apparent', (weather.apparentTemperature !== undefined && weather.apparentTemperature !== null) ? `${weather.apparentTemperature.toFixed(1)}°C` : '--°C');
    safeSetText('weather-condition', weather.condition || 'Estável');
    safeSetText('weather-icon', weather.icon || '🌤️');
    safeSetText('weather-humidity', (weather.humidity !== undefined && weather.humidity !== null) ? `${weather.humidity}%` : '--%');
    safeSetText('weather-wind', (weather.windSpeed !== undefined && weather.windSpeed !== null) ? `${weather.windSpeed} km/h` : '-- km/h');
    safeSetText('weather-gusts', (weather.windGusts !== undefined && weather.windGusts !== null) ? `${weather.windGusts} km/h` : '-- km/h');
    safeSetText('weather-pressure', (weather.surfacePressure !== undefined && weather.surfacePressure !== null) ? `${weather.surfacePressure} hPa` : '-- hPa');
    safeSetText('weather-precip', (weather.precipitation !== undefined && weather.precipitation !== null) ? `${weather.precipitation} mm` : '0 mm');

    // 2a. Widget de Índice UV
    if (weather.uvInfo) {
      safeSetText('uv-icon', weather.uvInfo.icon || '🟢');
      safeSetText('uv-index', weather.uvIndex !== undefined ? weather.uvIndex.toFixed(1) : '--');
      const uvLevelEl = document.getElementById('uv-level');
      if (uvLevelEl) {
        uvLevelEl.textContent = weather.uvInfo.level || '--';
        uvLevelEl.style.background = weather.uvInfo.color || '#10b981';
      }
      safeSetText('uv-tip-text', weather.uvInfo.tip || '');
    }

    // 2b. Bússola de vento — rotaciona a seta conforme graus
    if (weather.windDirection !== undefined && weather.windDirection !== null) {
      const arrowEl = document.getElementById('wind-arrow');
      if (arrowEl) {
        arrowEl.style.transform = `translate(-50%, -50%) rotate(${weather.windDirection}deg)`;
        arrowEl.title = `${weather.windDirection}° — ${weather.windCardinal?.label || ''}`;
      }
      const cardinal = weather.windCardinal;
      if (cardinal) {
        safeSetText('weather-wind-cardinal', `${cardinal.abbr} — ${cardinal.label}`);
      }
    }

    // 3. Card de Qualidade do Ar
    const aqiScoreEl = document.getElementById('aqi-score');
    const aqiPillEl = document.getElementById('aqi-status-pill');
    if (aqiScoreEl) {
      aqiScoreEl.textContent = airQuality.iqarConama ?? 30;
      aqiScoreEl.style.color = airQuality.color || '#10b981';
    }
    if (aqiPillEl) {
      aqiPillEl.textContent = airQuality.category || 'Boa';
      aqiPillEl.style.backgroundColor = airQuality.color || '#10b981';
    }

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

    safeSetText('aqi-recommendation-text', airQuality.recommendation || 'Condições favoráveis para atividades rotineiras ao ar livre.');
    safeSetText('val-pm25', (airQuality.pm2_5 !== undefined && airQuality.pm2_5 !== null) ? `${airQuality.pm2_5} µg/m³` : '--');
    safeSetText('val-pm10', (airQuality.pm10 !== undefined && airQuality.pm10 !== null) ? `${airQuality.pm10} µg/m³` : '--');
    safeSetText('val-ozone', (airQuality.ozone !== undefined && airQuality.ozone !== null) ? `${airQuality.ozone} µg/m³` : '--');
    safeSetText('val-no2', (airQuality.nitrogenDioxide !== undefined && airQuality.nitrogenDioxide !== null) ? `${airQuality.nitrogenDioxide} µg/m³` : '--');
    safeSetText('val-so2', (airQuality.sulphurDioxide !== undefined && airQuality.sulphurDioxide !== null) ? `${airQuality.sulphurDioxide} µg/m³` : '--');
    safeSetText('val-co', (airQuality.carbonMonoxide !== undefined && airQuality.carbonMonoxide !== null) ? `${airQuality.carbonMonoxide} µg/m³` : '--');

    // 4. Card de Informações da Cidade
    safeSetText('city-description', city.description || '');
    safeSetText('city-population', city.population ? city.population.toLocaleString('pt-BR') : '--');
    safeSetText('city-elevation', city.elevation ? `${city.elevation}m` : '--');
    safeSetText('city-coords', (city.latitude && city.longitude) ? `${city.latitude}, ${city.longitude}` : '--');

    // 5. Gráficos específicos da cidade
    if (window.ClimaCharts) {
      if (weather.forecastHourly) {
        window.ClimaCharts.renderWeatherHourlyChart(weather.forecastHourly);
      }
      if (airQuality.forecastHourly) {
        window.ClimaCharts.renderPollutantsChart(airQuality.forecastHourly);
      }
    }

    // 6. Previsão Estendida de 5 Dias
    if (weather.forecastDaily) {
      renderDailyForecast(weather.forecastDaily);
    }

    if (window.A11y) {
      window.A11y.announce(`Dados de ${city.name} carregados: Temperatura de ${Math.round(weather.temperature)} graus e qualidade do ar ${airQuality.category}.`);
    }
  }

  /**
   * Renderiza os cards de previsão estendida dos próximos 5 dias
   */
  function renderDailyForecast(forecastList) {
    const container = document.getElementById('forecast-daily-container');
    if (!container || !forecastList) return;

    container.innerHTML = '';

    forecastList.forEach((day, index) => {
      const isToday = index === 0;
      const card = document.createElement('article');
      card.className = `forecast-card ${isToday ? 'today' : ''}`;
      card.setAttribute('aria-label', `Previsão para ${day.weekday}, ${day.dayFormatted}: ${day.condition}, mínima de ${day.tempMin} graus e máxima de ${day.tempMax} graus.`);

      card.innerHTML = `
        <div class="forecast-day">${day.weekday}</div>
        <div class="forecast-date">${day.dayFormatted}</div>
        <div class="forecast-icon" aria-hidden="true">${day.icon}</div>
        <div class="forecast-condition">${day.condition}</div>
        <div class="forecast-temp-range">
          <span class="temp-min" title="Mínima prevista">${day.tempMin}°</span>
          <span class="temp-divider" aria-hidden="true"></span>
          <span class="temp-max" title="Máxima prevista">${day.tempMax}°</span>
        </div>
        <div class="forecast-rain-badge">
          <span>${day.precipitationProb}%</span>
          ${day.precipitationSum > 0 ? `<span style="font-size: 0.65rem; color: #0369a1;">(${day.precipitationSum}mm)</span>` : ''}
        </div>
      `;

      container.appendChild(card);
    });
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
        <div class="alert-card" style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-left: 5px solid #10b981; color: #065f46;">
          <div class="alert-content">
            <h3 style="color: #065f46; margin: 0 0 4px; font-weight: 700;">Condições Estáveis</h3>
            <p style="color: #047857; margin: 0; font-size: 0.9rem;">Nenhum alerta meteorológico ou de emergência emitido no momento para ${cityName}.</p>
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
