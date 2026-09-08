const axios = require('axios');
const { getCityById, CITIES } = require('../config/cities');
const { calculateOverallAQI, getWeatherInterpretation } = require('./aqiService');

// Cache em memória com TTL de 5 minutos para economizar chamadas e acelerar respostas
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Consulta dados climáticos atuais e previsões horárias na Open-Meteo
 */
async function fetchOpenMeteoWeather(latitude, longitude) {
  const url = 'https://api.open-meteo.com/v1/forecast';
  const params = {
    latitude,
    longitude,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'America/Sao_Paulo',
    forecast_days: 3
  };

  const response = await axios.get(url, { params, timeout: 8000 });
  return response.data;
}

/**
 * Consulta dados de qualidade do ar na Open-Meteo Air Quality API
 */
async function fetchOpenMeteoAirQuality(latitude, longitude) {
  const url = 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const params = {
    latitude,
    longitude,
    current: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi',
    hourly: 'pm10,pm2_5,ozone',
    timezone: 'America/Sao_Paulo',
    forecast_days: 2
  };

  const response = await axios.get(url, { params, timeout: 8000 });
  return response.data;
}

/**
 * Adaptador para Google Maps Platform / WeatherNext API
 * Caso o usuário configure sua chave no .env
 */
async function fetchGoogleWeather(latitude, longitude, apiKey) {
  try {
    // Exemplo de chamada para endpoint REST do Google Weather / Air Quality
    const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;
    const payload = {
      location: {
        latitude,
        longitude
      },
      extraComputations: ["HEALTH_RECOMMENDATIONS", "DOMINANT_POLLUTANT_CONCENTRATION"]
    };
    const response = await axios.post(url, payload, { timeout: 8000 });
    return response.data;
  } catch (error) {
    console.warn('[GOOGLE API] Falha no Google Weather API, fallback para Open-Meteo:', error.message);
    return null;
  }
}

/**
 * Avalia parâmetros meteorológicos e de poluição para gerar alertas
 */
function evaluateAlerts(city, weatherCurrent, aqiData) {
  const alerts = [];

  // Alerta de Umidade Relativa do Ar (Defesa Civil do Estado de SP / RMC)
  if (weatherCurrent.relative_humidity_2m <= 20) {
    alerts.push({
      city_id: city.id,
      alert_type: 'LOW_HUMIDITY',
      severity: 'DANGER',
      title: 'Alerta de Emergência: Baixa Umidade',
      message: `A umidade em ${city.name} está em ${weatherCurrent.relative_humidity_2m}%. Beba muita água e evite qualquer esforço físico ao ar livre.`
    });
  } else if (weatherCurrent.relative_humidity_2m <= 30) {
    alerts.push({
      city_id: city.id,
      alert_type: 'LOW_HUMIDITY',
      severity: 'WARNING',
      title: 'Estado de Atenção: Baixa Umidade',
      message: `A umidade em ${city.name} está em ${weatherCurrent.relative_humidity_2m}%. Mantenha-se hidratado e umedeça ambientes.`
    });
  }

  // Alerta de Onda de Calor
  if (weatherCurrent.temperature_2m >= 34) {
    alerts.push({
      city_id: city.id,
      alert_type: 'HEAT_WAVE',
      severity: 'WARNING',
      title: 'Alerta de Calor Excessivo',
      message: `Temperatura de ${weatherCurrent.temperature_2m.toFixed(1)}°C em ${city.name}. Proteja-se do sol e use protetor solar.`
    });
  }

  // Alerta de Qualidade do Ar
  if (aqiData.index > 120) {
    alerts.push({
      city_id: city.id,
      alert_type: 'AIR_QUALITY',
      severity: 'DANGER',
      title: 'Alerta Crítico: Qualidade do Ar Muito Ruim',
      message: `Índice de qualidade do ar em ${city.name} atingiu nível ${aqiData.category} (${aqiData.index}). Evite atividades ao ar livre.`
    });
  } else if (aqiData.index > 80) {
    alerts.push({
      city_id: city.id,
      alert_type: 'AIR_QUALITY',
      severity: 'WARNING',
      title: 'Atenção: Qualidade do Ar Inadequada',
      message: `O ar em ${city.name} está ${aqiData.category}. Grupos sensíveis com problemas respiratórios devem ter cuidado redobrado.`
    });
  }

  // Alerta de Chuva Forte
  if (weatherCurrent.precipitation >= 10) {
    alerts.push({
      city_id: city.id,
      alert_type: 'RAIN',
      severity: 'WARNING',
      title: 'Alerta de Chuva Intensa',
      message: `Precipitação acumulada de ${weatherCurrent.precipitation}mm em ${city.name}. Risco de pontos de lentidão e alagamento.`
    });
  }

  return alerts;
}

/**
 * Obtém os dados completos (clima + ar) consolidados para uma cidade
 */
async function getCityCompleteData(cityId) {
  const city = getCityById(cityId);
  if (!city) {
    throw new Error(`Cidade com ID "${cityId}" não encontrada.`);
  }

  const cacheKey = `data_${city.id}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  // Executa as consultas de Clima e Qualidade do Ar em paralelo
  const [weatherRaw, airRaw] = await Promise.all([
    fetchOpenMeteoWeather(city.latitude, city.longitude),
    fetchOpenMeteoAirQuality(city.latitude, city.longitude)
  ]);

  const weatherCurrent = weatherRaw.current;
  const airCurrent = airRaw.current;

  // Processa códigos meteorológicos
  const weatherInfo = getWeatherInterpretation(weatherCurrent.weather_code);

  // Calcula o índice CONAMA de qualidade do ar
  const aqiData = calculateOverallAQI({
    pm2_5: airCurrent.pm2_5,
    pm10: airCurrent.pm10,
    ozone: airCurrent.ozone
  });

  // Alertas
  const alerts = evaluateAlerts(city, weatherCurrent, aqiData);

  const payload = {
    city: {
      id: city.id,
      name: city.name,
      state: city.state,
      latitude: city.latitude,
      longitude: city.longitude,
      elevation: city.elevation,
      population: city.population,
      description: city.description
    },
    timestamp: weatherCurrent.time,
    weather: {
      temperature: weatherCurrent.temperature_2m,
      apparentTemperature: weatherCurrent.apparent_temperature,
      humidity: weatherCurrent.relative_humidity_2m,
      precipitation: weatherCurrent.precipitation,
      windSpeed: weatherCurrent.wind_speed_10m,
      windDirection: weatherCurrent.wind_direction_10m,
      surfacePressure: weatherCurrent.surface_pressure,
      weatherCode: weatherCurrent.weather_code,
      condition: weatherInfo.description,
      icon: weatherInfo.icon,
      forecastDaily: weatherRaw.daily,
      forecastHourly: {
        time: weatherRaw.hourly.time.slice(0, 24),
        temperature: weatherRaw.hourly.temperature_2m.slice(0, 24),
        humidity: weatherRaw.hourly.relative_humidity_2m.slice(0, 24),
        precipitationProb: weatherRaw.hourly.precipitation_probability.slice(0, 24)
      }
    },
    airQuality: {
      pm2_5: airCurrent.pm2_5,
      pm10: airCurrent.pm10,
      ozone: airCurrent.ozone,
      nitrogenDioxide: airCurrent.nitrogen_dioxide,
      sulphurDioxide: airCurrent.sulphur_dioxide,
      carbonMonoxide: airCurrent.carbon_monoxide,
      europeanAqi: airCurrent.european_aqi,
      iqarConama: aqiData.index,
      category: aqiData.category,
      level: aqiData.level,
      color: aqiData.color,
      dominantPollutant: aqiData.dominantPollutant,
      recommendation: aqiData.recommendation,
      subIndices: aqiData.subIndices,
      forecastHourly: {
        time: airRaw.hourly.time.slice(0, 24),
        pm2_5: airRaw.hourly.pm2_5.slice(0, 24),
        pm10: airRaw.hourly.pm10.slice(0, 24)
      }
    },
    alerts
  };

  cache.set(cacheKey, { timestamp: Date.now(), data: payload });
  return payload;
}

/**
 * Obtém os dados resumidos de todas as 3 cidades da RMC simultaneamente
 */
async function getAllCitiesSummary() {
  const promises = CITIES.map(city => getCityCompleteData(city.id));
  return Promise.all(promises);
}

module.exports = {
  getCityCompleteData,
  getAllCitiesSummary,
  fetchGoogleWeather,
  evaluateAlerts
};
