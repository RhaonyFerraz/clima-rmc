/**
 * Módulo de Recursos Visuais e Notificações Dinâmicas - ClimaRMC
 * 1. Favicon dinâmico na aba do navegador conforme o clima de Campinas (Sol, Chuva, Trovoadas, etc.)
 * 2. Notificações do Navegador com ícones contextuais e alertas
 * 3. App Badging API (estampa a temperatura atual no ícone do app no celular/desktop)
 */

const DynamicWeather = (function () {

  /**
   * Mapeamento de WMO Weather Codes para SVG otimizado de Favicon
   */
  function getFaviconSvgByWeather(weatherCode, iconEmoji) {
    // Códigos WMO da Open-Meteo:
    // 0: Céu limpo
    // 1-3: Predomínio de sol a nublado
    // 45, 48: Nevoeiro
    // 51-65, 80-81: Chuvas e garoas
    // 82, 95-99: Tempestades e trovoadas
    let emoji = iconEmoji || '🌤️';

    if (weatherCode === 0) {
      emoji = '☀️';
    } else if (weatherCode === 1 || weatherCode === 2) {
      emoji = '⛅';
    } else if (weatherCode === 3) {
      emoji = '☁️';
    } else if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 81)) {
      emoji = '🌧️';
    } else if (weatherCode >= 82 || (weatherCode >= 95 && weatherCode <= 99)) {
      emoji = '⛈️';
    } else if (weatherCode === 45 || weatherCode === 48) {
      emoji = '🌫️';
    }

    // Retorna SVG Data-URI com fundo circular estilizado e o emoji de clima em alta definição
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="30" fill="#0c1a2e" stroke="#0284c7" stroke-width="2"/>
      <text x="50%" y="54%" font-size="34" text-anchor="middle" dominant-baseline="central">${emoji}</text>
    </svg>`;

    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  /**
   * 1. Atualiza o Favicon da aba do navegador dinamicamente
   */
  function updateFavicon(weatherCode, iconEmoji) {
    try {
      let link = document.getElementById('dynamic-favicon');
      if (!link) {
        link = document.querySelector("link[rel*='icon']");
      }
      if (!link) {
        link = document.createElement('link');
        link.id = 'dynamic-favicon';
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        document.head.appendChild(link);
      }

      const faviconDataUri = getFaviconSvgByWeather(weatherCode, iconEmoji);
      link.href = faviconDataUri;
    } catch (err) {
      console.warn('[DynamicWeather] Falha ao atualizar favicon:', err);
    }
  }

  /**
   * 2. App Badging API: exibe a temperatura atual de Campinas no ícone do aplicativo PWA
   */
  async function updateBadge(temperature) {
    if ('setAppBadge' in navigator) {
      try {
        const roundedTemp = Math.round(temperature);
        if (!isNaN(roundedTemp) && roundedTemp > 0) {
          await navigator.setAppBadge(roundedTemp);
        } else {
          await navigator.clearAppBadge();
        }
      } catch (err) {
        // Fallback silencioso caso a plataforma restrinja badging
        console.debug('[DynamicWeather] Badging API não suportada ou não permitida:', err);
      }
    }
  }

  /**
   * 3. Sistema de Notificações Locais com ícones contextuais do clima
   */
  let lastNotificationTime = 0;

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações de sistema.');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    alert('As notificações estão bloqueadas nas configurações do seu navegador.');
    return false;
  }

  function sendWeatherNotification(campinasData) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const { weather, airQuality } = campinasData;
    const temp = Math.round(weather.temperature);
    const cond = weather.condition || 'Estável';
    const aqi = airQuality?.category || 'Boa';

    const title = `Campinas: ${temp}°C • ${cond}`;
    const options = {
      body: `Qualidade do Ar: ${aqi} (IQAr CONAMA: ${airQuality?.iqarConama ?? 30})\nUmidade: ${weather.humidity}% • Vento: ${weather.windSpeed} km/h`,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag: 'clima-rmc-campinas',
      renotify: true
    };

    try {
      new Notification(title, options);
    } catch (e) {
      // Em alguns navegadores Android PWA, notificações devem ser enviadas pelo Service Worker
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, options);
        });
      }
    }
  }

  /**
   * Configura o botão de Alertas/Notificações no Header
   */
  function setupNotificationButton(getCampinasDataCallback) {
    const notifyBtn = document.getElementById('btn-weather-alerts');
    if (!notifyBtn) return;

    // Atualiza estado visual inicial
    if ('Notification' in window && Notification.permission === 'granted') {
      notifyBtn.classList.add('alerts-active');
      notifyBtn.title = 'Alertas climáticos ativados';
    }

    notifyBtn.addEventListener('click', async () => {
      const granted = await requestNotificationPermission();
      if (granted) {
        notifyBtn.classList.add('alerts-active');
        notifyBtn.title = 'Alertas climáticos ativados';
        if (window.A11y) window.A11y.announce('Alertas de clima ativados com sucesso!');

        // Dispara uma notificação imediata com os dados atuais de Campinas
        const campinasData = getCampinasDataCallback ? getCampinasDataCallback() : null;
        if (campinasData && campinasData.weather) {
          sendWeatherNotification(campinasData);
        }
      }
    });
  }

  /**
   * Função principal chamada quando os dados de Campinas são carregados/sincronizados
   */
  function updateFromCampinas(campinasData) {
    if (!campinasData || !campinasData.weather) return;

    const weather = campinasData.weather;
    const weatherCode = weather.weatherCode !== undefined ? weather.weatherCode : null;
    const icon = weather.icon || '🌤️';
    const temp = weather.temperature;

    // 1. Atualiza Favicon dinamicamente
    updateFavicon(weatherCode, icon);

    // 2. Atualiza Badge do PWA (temperatura no ícone do celular/desktop)
    if (temp !== undefined && temp !== null) {
      updateBadge(temp);
    }

    // 3. Se houver alerta de tempestade severa (WMO >= 82) e usuário permitiu notificações, alerta automaticamente
    if (weatherCode >= 82 && ('Notification' in window) && Notification.permission === 'granted') {
      const now = Date.now();
      // Não repete alerta em intervalo menor que 30 minutos
      if (now - lastNotificationTime > 30 * 60 * 1000) {
        lastNotificationTime = now;
        sendWeatherNotification(campinasData);
      }
    }
  }

  return {
    updateFromCampinas,
    updateFavicon,
    updateBadge,
    setupNotificationButton,
    sendWeatherNotification
  };
})();

// Exporta globalmente para uso na aplicação
window.DynamicWeather = DynamicWeather;
