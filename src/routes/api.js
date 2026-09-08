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

/**
 * @swagger
 * /api/cities:
 *   get:
 *     tags: [Cidades]
 *     summary: Lista as cidades monitoradas da RMC
 *     description: Retorna os dados geográficos e demográficos das 3 cidades monitoradas — Campinas, Sumaré e Hortolândia.
 *     responses:
 *       200:
 *         description: Lista de cidades retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/City'
 */
router.get('/cities', getCities);

/**
 * @swagger
 * /api/weather/all/summary:
 *   get:
 *     tags: [Clima e Ar]
 *     summary: Resumo simultâneo das 3 cidades da RMC
 *     description: |
 *       Retorna clima atual, qualidade do ar e alertas de Campinas, Sumaré e Hortolândia
 *       em uma única requisição. Dados cacheados por 5 minutos.
 *     responses:
 *       200:
 *         description: Resumo das 3 cidades retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WeatherData'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/weather/all/summary', getAllCurrent);

/**
 * @swagger
 * /api/weather/{cityId}:
 *   get:
 *     tags: [Clima e Ar]
 *     summary: Dados completos em tempo real de uma cidade
 *     description: |
 *       Retorna dados completos de clima e qualidade do ar para a cidade especificada,
 *       incluindo previsão horária (24h), previsão diária (5 dias), índice UV, bússola de vento
 *       e alertas automáticos baseados nos padrões CONAMA e Defesa Civil SP.
 *     parameters:
 *       - in: path
 *         name: cityId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [campinas, sumare, hortolandia]
 *         description: Identificador da cidade
 *         example: campinas
 *     responses:
 *       200:
 *         description: Dados da cidade retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/WeatherData'
 *       404:
 *         description: Cidade não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/weather/:cityId', getCurrentWeather);

/**
 * @swagger
 * /api/weather/{cityId}/history:
 *   get:
 *     tags: [Histórico]
 *     summary: Série histórica de leituras do banco SQLite
 *     description: |
 *       Consulta o banco de dados SQLite local e retorna séries temporais de temperatura,
 *       umidade, IQAr, PM2.5 e PM10 para o período especificado.
 *       As séries já estão formatadas para uso direto com Chart.js.
 *     parameters:
 *       - in: path
 *         name: cityId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [campinas, sumare, hortolandia]
 *         description: Identificador da cidade
 *         example: campinas
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *           minimum: 1
 *           maximum: 720
 *         description: Período de histórico em horas (24 = 1 dia, 168 = 7 dias, 720 = 30 dias)
 *         example: 24
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           minimum: 5
 *           maximum: 200
 *         description: Número máximo de leituras a retornar
 *         example: 100
 *     responses:
 *       200:
 *         description: Série histórica retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HistorySeries'
 *       404:
 *         description: Cidade não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/weather/:cityId/history', getCityHistory);

/**
 * @swagger
 * /api/weather/sync:
 *   post:
 *     tags: [Sistema]
 *     summary: Sincronização manual com as APIs meteorológicas
 *     description: |
 *       Dispara manualmente a busca de dados atualizados nas APIs Open-Meteo para as 3 cidades,
 *       e persiste os resultados no banco de dados SQLite. Normalmente executado automaticamente
 *       a cada hora pelo agendador (cron job).
 *     responses:
 *       200:
 *         description: Sincronização realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Sincronização com Open-Meteo e persistência no SQLite realizada com sucesso.' }
 *       500:
 *         description: Erro durante a sincronização
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/weather/sync', triggerSync);

/**
 * @swagger
 * /api/analysis:
 *   get:
 *     tags: [Análise]
 *     summary: Indicadores estatísticos e correlação de Pearson
 *     description: |
 *       Retorna análise estatística das leituras históricas do banco SQLite:
 *       - Médias, mínimas e máximas de temperatura, umidade, PM2.5, PM10 e IQAr por cidade
 *       - Correlação de Pearson entre umidade relativa e concentração de PM2.5
 *       - Interpretação textual da correlação para relatórios acadêmicos
 *     responses:
 *       200:
 *         description: Análise estatística retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     citiesSummary:
 *                       type: array
 *                       description: Resumo estatístico por cidade
 *                     statisticalInsights:
 *                       type: object
 *                       properties:
 *                         correlationHumidityVsPm25: { type: string, example: '0.73' }
 *                         interpretation: { type: string, example: 'Correlação positiva moderada.' }
 */
router.get('/analysis', getAnalysisData);

/**
 * @swagger
 * /api/export:
 *   get:
 *     tags: [Análise]
 *     summary: Exporta relatório de dados históricos
 *     description: |
 *       Exporta os dados históricos do banco SQLite em formato CSV ou JSON.
 *       O arquivo é baixado diretamente pelo browser com nome `clima_rmc_export.[ext]`.
 *     parameters:
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *         description: Formato do arquivo exportado
 *         example: csv
 *       - in: query
 *         name: cityId
 *         schema:
 *           type: string
 *           enum: [campinas, sumare, hortolandia]
 *         description: Filtra por cidade (opcional — sem filtro retorna todas)
 *         example: campinas
 *     responses:
 *       200:
 *         description: Arquivo exportado com sucesso (download)
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: array
 *       400:
 *         description: Formato inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/export', exportData);

module.exports = router;
