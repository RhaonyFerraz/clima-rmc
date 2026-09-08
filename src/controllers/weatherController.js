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
 */
async function getCityHistory(req, res) {
  try {
    const { cityId } = req.params;
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 24));

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
      ORDER BY w.recorded_at DESC
      LIMIT ?
    `, [city.id, limit]);

    return res.json({
      success: true,
      city,
      count: rows.length,
      data: rows.reverse() // Ordena cronológico crescente para plotagem de gráficos
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
