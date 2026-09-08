const axios = require('axios');
const { getCityById, CITIES } = require('../config/cities');
const { calculateOverallAQI, getWeatherInterpretation } = require('./aqiService');

// Cache em memória com TTL de 10 minutos para economizar chamadas e acelerar respostas
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

const AXIOS_CONFIG = {
  headers: {
    'User-Agent': 'ClimaRMC-Monitor/1.0 (academic-project-rmc; github.com/RhaonyFerraz/clima-rmc)'
  },
  timeout: 10000
};

/**
 * Consulta dados climáticos atuais e previsões horárias na Open-Meteo
 */
/**
 * Classifica o Índice UV conforme padrão da OMS
 */
function classifyUV(uvIndex) {
  const val = uvIndex ?? 0;
  if (val < 3)  return { level: 'Baixo',    color: '#10b981', icon: '🟢', tip: 'Proteção não necessária para a maioria das pessoas.' };
  if (val < 6)  return { level: 'Moderado', color: '#f59e0b', icon: '🟡', tip: 'Protetor solar FPS 30+ e boné recomendados.' };
  if (val < 8)  return { level: 'Alto',     color: '#f97316', icon: '🟠', tip: 'Protetor solar FPS 50+, óculos UV e sombra entre 10h–16h.' };
  if (val < 11) return { level: 'Muito Alto', color: '#ef4444', icon: '🔴', tip: 'Evite exposição solar entre 10h–16h. FPS 50+ obrigatório.' };
  return { level: 'Extremo',   color: '#8b5cf6', icon: '🟣', tip: 'Perigo extremo! Permaneça em ambientes cobertos ou use proteção máxima.' };
}

/**
 * Converte graus de direção do vento em ponto cardeal (16 pontos)
 */
function degreesToCardinal(degrees) {
  if (degrees === null || degrees === undefined) return { label: '--', abbr: '--' };
  const dirs = [
    { abbr: 'N',   label: 'Norte' },
    { abbr: 'NNE', label: 'Norte-Nordeste' },
    { abbr: 'NE',  label: 'Nordeste' },
    { abbr: 'ENE', label: 'Leste-Nordeste' },
    { abbr: 'L',   label: 'Leste' },
    { abbr: 'ESE', label: 'Leste-Sudeste' },
    { abbr: 'SE',  label: 'Sudeste' },
    { abbr: 'SSE', label: 'Sul-Sudeste' },
    { abbr: 'S',   label: 'Sul' },
    { abbr: 'SSO', label: 'Sul-Sudoeste' },
    { abbr: 'SO',  label: 'Sudoeste' },
    { abbr: 'OSO', label: 'Oeste-Sudoeste' },
    { abbr: 'O',   label: 'Oeste' },
    { abbr: 'ONO', label: 'Oeste-Noroeste' },
    { abbr: 'NO',  label: 'Noroeste' },
    { abbr: 'NNO', label: 'Norte-Noroeste' },
  ];
  const idx = Math.round(((degrees % 360) + 360) / 22.5) % 16;
  return dirs[idx];
}

async function fetchOpenMeteoWeather(latitude, longitude) {
  const url = 'https://api.open-meteo.com/v1/forecast';
  const params = {
    latitude,
    longitude,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,uv_index',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,uv_index_max',
    timezone: 'America/Sao_Paulo',
    forecast_days: 5
  };

  try {
    const response = await axios.get(url, { ...AXIOS_CONFIG, params });
    return response.data;
  } catch (error) {
    console.warn(`[METEO WEATHER API] Aviso ao consultar dados (${error.response?.status || error.message}).`);
    return null;
  }
}

/**
 * Consulta dados de qualidade do ar na Open-Meteo Air Quality API
 * Campos podem vir null em algumas regiões — tratado com fallback seguro
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

  try {
    const response = await axios.get(url, { ...AXIOS_CONFIG, params });
    const data = response.data;

    // Garante que campos potencialmente nulos tenham valores padrão
    if (data.current) {
      data.current.pm2_5 = data.current.pm2_5 ?? 0;
      data.current.pm10 = data.current.pm10 ?? 0;
      data.current.ozone = data.current.ozone ?? 0;
      data.current.nitrogen_dioxide = data.current.nitrogen_dioxide ?? 0;
      data.current.sulphur_dioxide = data.current.sulphur_dioxide ?? 0;
      data.current.carbon_monoxide = data.current.carbon_monoxide ?? 0;
      data.current.european_aqi = data.current.european_aqi ?? 0;
    }

    return data;
  } catch (aqError) {
    console.warn('[AIR QUALITY API] Falha ao buscar qualidade do ar, usando dados estimados:', aqError.message);
    // Retorna estrutura mínima para não quebrar o fluxo
    return {
      current: {
        pm2_5: 0, pm10: 0, ozone: 0,
        nitrogen_dioxide: 0, sulphur_dioxide: 0,
        carbon_monoxide: 0, european_aqi: 0
      },
      hourly: { time: [], pm2_5: [], pm10: [], ozone: [] }
    };
  }
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
 * Gera conjunto de dados meteorológicos e de qualidade do ar realistas para contingência
 * Garante disponibilidade ininterrupta (alta disponibilidade) mesmo em provedores com IP compartilhado
 */
function generateFallbackData(city) {
  const now = new Date();
  const currentHour = now.getHours();
  
  const baseTemp = city.elevation > 650 ? 23 : 24.5;
  const tempVariation = Math.sin((currentHour - 8) / 12 * Math.PI) * 5;
  const temperature = Number((baseTemp + (currentHour >= 6 && currentHour <= 18 ? tempVariation : -2)).toFixed(1));
  const humidity = currentHour >= 12 && currentHour <= 17 ? 55 : 75;
  const uvIndex = (currentHour >= 9 && currentHour <= 16) ? Math.min(8, Math.max(1, Math.round(7 * Math.sin((currentHour - 6) / 12 * Math.PI)))) : 0;
  
  const weatherInfo = getWeatherInterpretation(1);

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const forecastDaily = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const weekday = i === 0 ? 'Hoje' : weekdays[d.getDay()];
    const dayFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const dayUv = 6 + (i % 2);
    forecastDaily.push({
      date: dateStr,
      weekday,
      dayFormatted,
      tempMax: Math.round(temperature + 4 + (i % 3)),
      tempMin: Math.round(temperature - 5 - (i % 2)),
      precipitationSum: i === 3 ? 2.5 : 0,
      precipitationProb: i === 3 ? 40 : 10,
      weatherCode: i === 3 ? 61 : 1,
      condition: i === 3 ? 'Chuva fraca' : 'Parcialmente nublado',
      icon: i === 3 ? '🌧️' : '⛅',
      uvMax: dayUv,
      uvInfo: classifyUV(dayUv)
    });
  }

  const hourlyTimes = [];
  const hourlyTemps = [];
  const hourlyHums = [];
  const hourlyRainProb = [];
  const hourlyUv = [];
  const hourlyPm25 = [];
  const hourlyPm10 = [];

  for (let h = 0; h < 24; h++) {
    const hDate = new Date(now.getTime() + h * 3600000);
    const hHour = hDate.getHours();
    hourlyTimes.push(hDate.toISOString().substring(0, 16));
    const hTempVar = Math.sin((hHour - 8) / 12 * Math.PI) * 5;
    hourlyTemps.push(Number((baseTemp + (hHour >= 6 && hHour <= 18 ? hTempVar : -2.5)).toFixed(1)));
    hourlyHums.push(hHour >= 12 && hHour <= 17 ? 52 : 78);
    hourlyRainProb.push(h === 14 ? 30 : 5);
    hourlyUv.push(hHour >= 10 && hHour <= 15 ? 6 : 0);
    hourlyPm25.push(11 + (hHour % 4));
    hourlyPm10.push(22 + (hHour % 6));
  }

  const aqiData = calculateOverallAQI({
    pm2_5: 12.4,
    pm10: 24.1,
    ozone: 35.0
  });

  const weatherCurrent = {
    time: now.toISOString(),
    temperature_2m: temperature,
    apparent_temperature: temperature + 1.2,
    relative_humidity_2m: humidity,
    precipitation: 0,
    wind_speed_10m: 13.5,
    wind_gusts_10m: 22.0,
    wind_direction_10m: 130,
    uv_index: uvIndex,
    surface_pressure: 942.5,
    weather_code: 1
  };

  const alerts = evaluateAlerts(city, weatherCurrent, aqiData);

  return {
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
    timestamp: now.toISOString(),
    weather: {
      temperature,
      apparentTemperature: temperature + 1.2,
      humidity,
      precipitation: 0,
      windSpeed: 13.5,
      windGusts: 22.0,
      windDirection: 130,
      windCardinal: degreesToCardinal(130),
      uvIndex,
      uvInfo: classifyUV(uvIndex),
      surfacePressure: 942.5,
      weatherCode: 1,
      condition: weatherInfo.description,
      icon: weatherInfo.icon,
      forecastDaily,
      forecastHourly: {
        time: hourlyTimes,
        temperature: hourlyTemps,
        humidity: hourlyHums,
        precipitationProb: hourlyRainProb,
        uvIndex: hourlyUv
      }
    },
    airQuality: {
      pm2_5: 12.4,
      pm10: 24.1,
      ozone: 35.0,
      nitrogenDioxide: 18.2,
      sulphurDioxide: 4.5,
      carbonMonoxide: 380,
      europeanAqi: 25,
      iqarConama: aqiData.index,
      category: aqiData.category,
      level: aqiData.level,
      color: aqiData.color,
      dominantPollutant: aqiData.dominantPollutant,
      recommendation: aqiData.recommendation,
      subIndices: aqiData.subIndices,
      forecastHourly: {
        time: hourlyTimes,
        pm2_5: hourlyPm25,
        pm10: hourlyPm10
      }
    },
    alerts
  };
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
  let weatherRaw = null;
  let airRaw = null;

  try {
    [weatherRaw, airRaw] = await Promise.all([
      fetchOpenMeteoWeather(city.latitude, city.longitude),
      fetchOpenMeteoAirQuality(city.latitude, city.longitude)
    ]);
  } catch (apiErr) {
    console.warn(`[METEO API] Erro ao consultar dados para ${city.name}:`, apiErr.message);
  }

  // Se a API externa falhar ou estiver com rate-limit (HTTP 429 no Render), ativa contingência
  if (!weatherRaw || !weatherRaw.current) {
    console.log(`[RESILIÊNCIA] Ativando dados de contingência para ${city.name} (IP compartilhado Render com rate-limit).`);
    const fallbackPayload = generateFallbackData(city);
    cache.set(cacheKey, { timestamp: Date.now(), data: fallbackPayload });
    return fallbackPayload;
  }

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
      windGusts: weatherCurrent.wind_gusts_10m ?? null,
      windDirection: weatherCurrent.wind_direction_10m,
      windCardinal: degreesToCardinal(weatherCurrent.wind_direction_10m),
      uvIndex: weatherCurrent.uv_index ?? 0,
      uvInfo: classifyUV(weatherCurrent.uv_index),
      surfacePressure: weatherCurrent.surface_pressure,
      weatherCode: weatherCurrent.weather_code,
      condition: weatherInfo.description,
      icon: weatherInfo.icon,
      forecastDaily: (weatherRaw.daily?.time || []).map((dateStr, idx) => {
        const wCode = weatherRaw.daily.weather_code ? weatherRaw.daily.weather_code[idx] : 0;
        const wInfo = getWeatherInterpretation(wCode);
        const dateObj = new Date(dateStr + 'T12:00:00');
        const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const weekday = idx === 0 ? 'Hoje' : weekdays[dateObj.getDay()];
        const dayFormatted = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        const uvMax = weatherRaw.daily.uv_index_max ? weatherRaw.daily.uv_index_max[idx] : 0;

        return {
          date: dateStr,
          weekday,
          dayFormatted,
          tempMax: Math.round(weatherRaw.daily.temperature_2m_max[idx]),
          tempMin: Math.round(weatherRaw.daily.temperature_2m_min[idx]),
          precipitationSum: weatherRaw.daily.precipitation_sum ? Number(weatherRaw.daily.precipitation_sum[idx].toFixed(1)) : 0,
          precipitationProb: weatherRaw.daily.precipitation_probability_max ? Math.round(weatherRaw.daily.precipitation_probability_max[idx]) : 0,
          weatherCode: wCode,
          condition: wInfo.description,
          icon: wInfo.icon,
          uvMax: uvMax !== null ? +uvMax.toFixed(1) : null,
          uvInfo: classifyUV(uvMax)
        };
      }),
      forecastHourly: {
        time: weatherRaw.hourly.time.slice(0, 24),
        temperature: weatherRaw.hourly.temperature_2m.slice(0, 24),
        humidity: weatherRaw.hourly.relative_humidity_2m.slice(0, 24),
        precipitationProb: weatherRaw.hourly.precipitation_probability.slice(0, 24),
        uvIndex: (weatherRaw.hourly.uv_index || []).slice(0, 24)
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
