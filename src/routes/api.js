const express = require('express');
const router = express.Router();

const {
  getCities,
  getCurrentWeather,
  getAllCurrent,
  getCityHistory,
  triggerSync
} = require('../controllers/weatherController');

const {
  getAnalysisData,
  exportData
} = require('../controllers/analysisController');

// Rotas de Cidades e Clima
router.get('/cities', getCities);
router.get('/weather/all/summary', getAllCurrent);
router.get('/weather/:cityId', getCurrentWeather);
router.get('/weather/:cityId/history', getCityHistory);
router.post('/weather/sync', triggerSync);

// Rotas de Análise de Dados e Exportação
router.get('/analysis', getAnalysisData);
router.get('/export', exportData);

module.exports = router;
