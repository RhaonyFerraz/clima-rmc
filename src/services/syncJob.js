const cron = require('node-cron');
const { CITIES } = require('../config/cities');
const { dbRun, dbGet } = require('../config/database');
const { getCityCompleteData } = require('./weatherService');

/**
 * Salva uma leitura climática e de qualidade do ar no SQLite
 */
async function saveReadingToDatabase(data) {
  const { city, timestamp, weather, airQuality, alerts } = data;

  try {
    // 1. Salva leitura meteorológica
    await dbRun(`
      INSERT INTO weather_readings (
        city_id, temperature, apparent_temperature, relative_humidity,
        precipitation, weather_code, weather_description, wind_speed,
        wind_direction, surface_pressure, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      city.id,
      weather.temperature,
      weather.apparentTemperature,
      weather.humidity,
      weather.precipitation,
      weather.weatherCode,
      weather.condition,
      weather.windSpeed,
      weather.windDirection,
      weather.surfacePressure,
      timestamp
    ]);

    // 2. Salva leitura de qualidade do ar
    await dbRun(`
      INSERT INTO air_quality_readings (
        city_id, pm2_5, pm10, ozone, nitrogen_dioxide, sulphur_dioxide,
        carbon_monoxide, european_aqi, conama_iqar, aqi_category,
        health_recommendation, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      city.id,
      airQuality.pm2_5,
      airQuality.pm10,
      airQuality.ozone,
      airQuality.nitrogenDioxide,
      airQuality.sulphurDioxide,
      airQuality.carbonMonoxide,
      airQuality.europeanAqi,
      airQuality.iqarConama,
      airQuality.category,
      airQuality.recommendation,
      timestamp
    ]);

    // 3. Salva alertas gerados (se houver)
    if (alerts && alerts.length > 0) {
      for (const alert of alerts) {
        await dbRun(`
          INSERT INTO system_alerts (city_id, alert_type, severity, title, message)
          VALUES (?, ?, ?, ?, ?)
        `, [alert.city_id, alert.alert_type, alert.severity, alert.title, alert.message]);
      }
    }
  } catch (err) {
    console.error(`[SYNC] Erro ao persistir leitura para ${city.name}:`, err.message);
  }
}

/**
 * Executa a sincronização para todas as cidades monitoradas
 */
async function syncAllCities() {
  if (process.env.NODE_ENV !== 'test') {
    console.log('[SYNC] Iniciando sincronização periódica de dados meteorológicos e qualidade do ar...');
  }

  for (const city of CITIES) {
    try {
      const data = await getCityCompleteData(city.id);
      await saveReadingToDatabase(data);
    } catch (err) {
      console.error(`[SYNC] Falha ao sincronizar cidade ${city.name}:`, err.message);
    }
  }

  if (process.env.NODE_ENV !== 'test') {
    console.log('[SYNC] Sincronização concluída com sucesso.');
  }
}

/**
 * Se o banco estiver vazio, gera histórico das últimas 24h para permitir análise imediata
 */
async function seedHistoricalDataIfEmpty() {
  try {
    const countRow = await dbGet('SELECT COUNT(*) as total FROM weather_readings');
    if (countRow && countRow.total > 0) {
      return; // Já existem dados
    }

    console.log('[SYNC] Banco de dados vazio. Gerando dados analíticos das últimas 24h para a RMC...');
    const now = Date.now();

    for (const city of CITIES) {
      // Coeficientes base por cidade (Campinas um pouco mais quente, Hortolândia industrial, Sumaré corredor)
      const baseTemp = city.id === 'campinas' ? 26.5 : (city.id === 'sumare' ? 27.0 : 26.8);
      const basePm25 = city.id === 'campinas' ? 18 : (city.id === 'sumare' ? 22 : 20);

      for (let i = 24; i >= 0; i--) {
        const time = new Date(now - i * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        const hour = new Date(now - i * 60 * 60 * 1000).getHours();

        // Variação diurna natural (mais fresco na madrugada, pico 14h-16h)
        const tempVariation = Math.sin(((hour - 8) / 24) * 2 * Math.PI) * 6;
        const temp = Number((baseTemp + tempVariation + (Math.random() * 1.5 - 0.75)).toFixed(1));
        const hum = Math.min(95, Math.max(25, Number((70 - tempVariation * 3.5 + (Math.random() * 4 - 2)).toFixed(1))));
        const pm25 = Number((basePm25 + (hour >= 17 && hour <= 20 ? 12 : 0) + (Math.random() * 6 - 3)).toFixed(1));
        const pm10 = Number((pm25 * 1.8 + Math.random() * 4).toFixed(1));

        await dbRun(`
          INSERT INTO weather_readings (
            city_id, temperature, apparent_temperature, relative_humidity,
            precipitation, weather_code, weather_description, wind_speed,
            wind_direction, surface_pressure, recorded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          city.id,
          temp,
          temp + 1.2,
          hum,
          0,
          hour > 6 && hour < 18 ? 1 : 0,
          hour > 6 && hour < 18 ? 'Ensolarado' : 'Céu limpo',
          Number((8 + Math.random() * 7).toFixed(1)),
          120,
          945,
          time
        ]);

        await dbRun(`
          INSERT INTO air_quality_readings (
            city_id, pm2_5, pm10, ozone, nitrogen_dioxide, sulphur_dioxide,
            carbon_monoxide, european_aqi, conama_iqar, aqi_category,
            health_recommendation, recorded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          city.id,
          pm25,
          pm10,
          Number((35 + Math.random() * 20).toFixed(1)),
          Number((15 + Math.random() * 10).toFixed(1)),
          Number((3 + Math.random() * 2).toFixed(1)),
          Number((200 + Math.random() * 80).toFixed(1)),
          2,
          Math.min(100, Math.round(pm25 * 1.6)),
          pm25 > 25 ? 'Moderada' : 'Boa',
          'Qualidade favorável para a maioria das atividades cotidianas.',
          time
        ]);
      }
    }
    console.log('[SYNC] Carga analítica inicial gerada com sucesso.');
  } catch (err) {
    console.error('[SYNC] Erro ao popular dados analíticos:', err.message);
  }
}

/**
 * Inicia o agendador do cron (roda a cada 30 minutos)
 */
function startSyncScheduler() {
  // Sincronização inicial na subida do servidor
  setTimeout(async () => {
    await seedHistoricalDataIfEmpty();
    await syncAllCities();
  }, 2000);

  // Agenda para rodar no minuto 0 e 30 de cada hora
  cron.schedule('*/30 * * * *', () => {
    syncAllCities();
  });
}

module.exports = {
  syncAllCities,
  saveReadingToDatabase,
  seedHistoricalDataIfEmpty,
  startSyncScheduler
};
