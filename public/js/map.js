/**
 * Módulo do Mapa Geográfico Interativo da RMC - ClimaRMC
 * Implementado com Leaflet.js e OpenStreetMap
 */

(function () {
  let map = null;
  const markers = {};

  const CITIES_COORDS = {
    campinas: { lat: -22.9056, lng: -47.0608, name: 'Campinas' },
    sumare: { lat: -22.8206, lng: -47.2669, name: 'Sumaré' },
    hortolandia: { lat: -22.8583, lng: -47.2200, name: 'Hortolândia' }
  };

  function initMap() {
    const mapEl = document.getElementById('rmc-map');
    if (!mapEl || typeof L === 'undefined') return;

    // Centro geográfico equilibrado entre Campinas, Sumaré e Hortolândia
    const rmcCenter = [-22.865, -47.165];
    const initialZoom = window.innerWidth < 768 ? 10 : 11;

    map = L.map('rmc-map', {
      center: rmcCenter,
      zoom: initialZoom,
      scrollWheelZoom: false, // Evita captura involuntária do scroll da página
      attributionControl: true
    });

    // Camada de mapa OpenStreetMap limpa e de alta performance
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Cria os marcadores iniciais para cada cidade
    Object.keys(CITIES_COORDS).forEach(cityId => {
      const city = CITIES_COORDS[cityId];
      createCityMarker(cityId, city.lat, city.lng, city.name, 26, '#10b981', 'Boa');
    });

    // Garante que o Leaflet calcule o tamanho exato do container
    setTimeout(() => {
      map.invalidateSize();
    }, 400);
  }

  /**
   * Cria um marcador customizado com badge de temperatura e anel de qualidade do ar
   */
  function createCityMarker(cityId, lat, lng, cityName, temp, color, aqiCategory) {
    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div class="map-marker-pin" style="border-color: ${color};" id="marker-pin-${cityId}">
          <span class="marker-temp">${Math.round(temp)}°</span>
          <span class="marker-label">${cityName}</span>
        </div>
      `,
      iconSize: [64, 48],
      iconAnchor: [32, 24]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

    marker.on('click', () => {
      // Dispara a seleção da cidade no aplicativo principal
      const tab = document.querySelector(`.city-tab[data-city="${cityId}"]`);
      if (tab) tab.click();

      map.flyTo([lat, lng], 12, { duration: 1.2 });
    });

    markers[cityId] = marker;
  }

  /**
   * Atualiza os marcadores no mapa com os dados reais e abre popups informativos
   */
  function updateMapMarkers(citiesData) {
    if (!map || !citiesData) return;

    citiesData.forEach(item => {
      const cityId = item.city.id;
      const marker = markers[cityId];
      if (!marker) return;

      const temp = item.weather.temperature;
      const color = item.airQuality.color;
      const category = item.airQuality.category;
      const iqar = item.airQuality.iqarConama;
      const humidity = item.weather.humidity;
      const wind = item.weather.windSpeed;

      // Atualiza o visual do ícone
      const updatedIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="map-marker-pin" style="border-color: ${color};" id="marker-pin-${cityId}">
            <span class="marker-temp">${Math.round(temp)}°C</span>
            <span class="marker-label">${item.city.name}</span>
          </div>
        `,
        iconSize: [68, 50],
        iconAnchor: [34, 25]
      });

      marker.setIcon(updatedIcon);

      // Popup rico e interativo
      const popupContent = `
        <div class="map-popup-card">
          <h4 style="margin: 0 0 6px; font-size: 1rem; color: #0f172a; font-weight: 800;">${item.city.name}</h4>
          <div style="font-size: 0.85rem; color: #475569; margin-bottom: 8px;">${item.weather.condition}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.82rem; margin-bottom: 8px;">
            <div><strong>Temp:</strong> ${Math.round(temp)}°C</div>
            <div><strong>Umidade:</strong> ${humidity}%</div>
            <div><strong>Vento:</strong> ${wind} km/h</div>
            <div><strong>População:</strong> ${item.city.population?.toLocaleString('pt-BR')}</div>
          </div>
          <div style="background: ${color}; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-align: center;">
            IQAr ${iqar} • Ar ${category}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
    });
  }

  /**
   * Destaca visualmente a cidade selecionada no mapa
   */
  function highlightCityOnMap(cityId) {
    if (!map || !markers[cityId]) return;

    // Remove destaque anterior
    document.querySelectorAll('.map-marker-pin').forEach(el => {
      el.classList.remove('active-pin');
    });

    // Adiciona classe ativa
    const activePin = document.getElementById(`marker-pin-${cityId}`);
    if (activePin) {
      activePin.classList.add('active-pin');
    }

    const city = CITIES_COORDS[cityId];
    if (city) {
      map.panTo([city.lat, city.lng], { animate: true, duration: 0.8 });
    }
  }

  window.RmcMap = {
    init: initMap,
    updateMarkers: updateMapMarkers,
    highlightCity: highlightCityOnMap
  };

  document.addEventListener('DOMContentLoaded', initMap);
})();
