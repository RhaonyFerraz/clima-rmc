const request = require('supertest');
const app = require('../src/app');
const { initDatabase, dbRun } = require('../src/config/database');

beforeAll(async () => {
  // Inicializa banco de dados SQLite para os testes
  await initDatabase();
});

describe('Testes de Integração - API REST ClimaRMC', () => {
  describe('GET /health', () => {
    test('deve responder status 200 e confirmação de saúde', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  describe('GET /api/cities', () => {
    test('deve retornar a lista oficial das 3 cidades da RMC', async () => {
      const res = await request(app).get('/api/cities');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);

      const cityIds = res.body.data.map(c => c.id);
      expect(cityIds).toContain('campinas');
      expect(cityIds).toContain('sumare');
      expect(cityIds).toContain('hortolandia');
    });
  });

  describe('GET /api/weather/:cityId', () => {
    test('deve retornar dados climáticos e de qualidade do ar de Campinas', async () => {
      const res = await request(app).get('/api/weather/campinas');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.city.id).toBe('campinas');
      expect(res.body.data).toHaveProperty('weather');
      expect(res.body.data).toHaveProperty('airQuality');
      expect(res.body.data.airQuality).toHaveProperty('iqarConama');
    }, 15000); // 15s timeout para requisição externa na primeira vez

    test('deve retornar 404 para identificador de cidade inválido', async () => {
      const res = await request(app).get('/api/weather/cidade_inexistente');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/weather/all/summary', () => {
    test('deve retornar o resumo simultâneo das 3 cidades', async () => {
      const res = await request(app).get('/api/weather/all/summary');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
    }, 15000);
  });

  describe('GET /api/analysis', () => {
    test('deve retornar indicadores estatísticos e correlação', async () => {
      const res = await request(app).get('/api/analysis');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('citiesSummary');
      expect(res.body.data).toHaveProperty('statisticalInsights');
      expect(res.body.data.statisticalInsights).toHaveProperty('correlationHumidityVsPm25');
    });
  });

  describe('GET /api/export', () => {
    test('deve exportar relatório em formato CSV', async () => {
      const res = await request(app).get('/api/export?format=csv');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Cidade');
      expect(res.text).toContain('Temperatura');
    });

    test('deve exportar relatório em formato JSON', async () => {
      const res = await request(app).get('/api/export?format=json');
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('PWA - Progressive Web App Assets', () => {
    test('deve servir o manifest.json com configurações válidas de PWA', async () => {
      const res = await request(app).get('/manifest.json');
      expect(res.statusCode).toBe(200);
      expect(res.body.display).toBe('standalone');
      expect(res.body.start_url).toBe('/');
      expect(res.body.name).toContain('ClimaRMC');
      expect(Array.isArray(res.body.icons)).toBe(true);
    });

    test('deve servir o Service Worker (sw.js)', async () => {
      const res = await request(app).get('/sw.js');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('CACHE_NAME');
      expect(res.text).toContain('addEventListener');
    });
  });
});
