const { CITIES, getCityById } = require('../config/cities');
const { getCityCompleteData, getAllCitiesSummary } = require('../services/weatherService');
const { dbAll } = require('../config/database');
const { syncAllCities } = require('../services/syncJob');

/**
 * Retorna as cidades cadastradas
 */
async function getCities(req, res) {
  try {
    return res.json({
      success: true,
      data: CITIES
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Retorna dados em tempo real de uma cidade específica
 */
async function getCurrentWeather(req, res) {
  try {
    const { cityId } = req.params;
    const data = await getCityCompleteData(cityId);
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(404).json({ success: false, error: error.message });
  }
}

/**
 * Retorna visão geral de todas as 3 cidades da RMC simultaneamente
 */
async function getAllCurrent(req, res) {
  try {
    const data = await getAllCitiesSummary();
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Retorna histórico persistido no banco SQLite para gráficos e análises
 * Suporta filtro por período: hours=24 (padrão), hours=168 (7 dias), hours=720 (30 dias)
 */
async function getCityHistory(req, res) {
  try {
    const { cityId } = req.params;
    const hours = Math.min(720, Math.max(1, parseInt(req.query.hours, 10) || 24));
    const limit = Math.min(200, Math.max(5, parseInt(req.query.limit, 10) || 100));

    const city = getCityById(cityId);
    if (!city) {
      return res.status(404).json({ success: false, error: 'Cidade não encontrada.' });
    }

    const rows = await dbAll(`
      SELECT 
        w.id,
        w.city_id,
        w.temperature,
        w.apparent_temperature,
        w.relative_humidity,
        w.precipitation,
        w.wind_speed,
        w.weather_description,
        w.recorded_at,
        a.pm2_5,
        a.pm10,
        a.ozone,
        a.conama_iqar,
        a.aqi_category
      FROM weather_readings w
      LEFT JOIN air_quality_readings a 
        ON w.city_id = a.city_id 
        AND strftime('%Y-%m-%d %H', w.recorded_at) = strftime('%Y-%m-%d %H', a.recorded_at)
      WHERE w.city_id = ?
        AND w.recorded_at >= datetime('now', 'localtime', '-' || ? || ' hours')
      ORDER BY w.recorded_at ASC
      LIMIT ?
    `, [city.id, hours, limit]);

    // Monta séries temporais prontas para Chart.js
    const series = {
      labels: [],
      temperature: [],
      humidity: [],
      iqar: [],
      pm2_5: [],
      pm10: [],
      precipitation: []
    };

    rows.forEach(row => {
      const dt = new Date(row.recorded_at);
      const label = hours <= 24
        ? dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit' }) + 'h';
      series.labels.push(label);
      series.temperature.push(row.temperature !== null ? +row.temperature.toFixed(1) : null);
      series.humidity.push(row.relative_humidity !== null ? Math.round(row.relative_humidity) : null);
      series.iqar.push(row.conama_iqar !== null ? Math.round(row.conama_iqar) : null);
      series.pm2_5.push(row.pm2_5 !== null ? +row.pm2_5.toFixed(1) : null);
      series.pm10.push(row.pm10 !== null ? +row.pm10.toFixed(1) : null);
      series.precipitation.push(row.precipitation !== null ? +row.precipitation.toFixed(1) : null);
    });

    return res.json({
      success: true,
      city,
      period: { hours, label: hours <= 24 ? 'Últimas 24h' : hours <= 168 ? 'Últimos 7 dias' : 'Últimos 30 dias' },
      count: rows.length,
      series,
      data: rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Dispara sincronização manual com as APIs e grava no SQLite
 */
async function triggerSync(req, res) {
  try {
    await syncAllCities();
    return res.json({
      success: true,
      message: 'Sincronização com Open-Meteo e persistência no SQLite realizada com sucesso.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getCities,
  getCurrentWeather,
  getAllCurrent,
  getCityHistory,
  triggerSync
};
