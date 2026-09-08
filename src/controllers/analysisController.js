const { dbAll } = require('../config/database');
const { CITIES } = require('../config/cities');

/**
 * Calcula a correlação de Pearson simples entre duas séries numéricas
 */
function calculatePearsonCorrelation(x, y) {
  const n = x.length;
  if (n < 3) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(2));
}

/**
 * Retorna análise comparativa e estatística das cidades da RMC
 */
async function getAnalysisData(req, res) {
  try {
    const summaryPerCity = [];
    const correlationSample = { humidity: [], pm2_5: [] };

    for (const city of CITIES) {
      // Busca leituras das últimas 48 horas
      const rows = await dbAll(`
        SELECT 
          w.temperature,
          w.relative_humidity,
          w.wind_speed,
          a.pm2_5,
          a.pm10,
          a.conama_iqar,
          a.aqi_category
        FROM weather_readings w
        JOIN air_quality_readings a 
          ON w.city_id = a.city_id 
          AND strftime('%Y-%m-%d %H', w.recorded_at) = strftime('%Y-%m-%d %H', a.recorded_at)
        WHERE w.city_id = ?
        ORDER BY w.recorded_at DESC
        LIMIT 48
      `, [city.id]);

      if (rows.length > 0) {
        const temps = rows.map(r => r.temperature).filter(v => v !== null);
        const hums = rows.map(r => r.relative_humidity).filter(v => v !== null);
        const pm25s = rows.map(r => r.pm2_5).filter(v => v !== null);
        const pm10s = rows.map(r => r.pm10).filter(v => v !== null);
        const iqars = rows.map(r => r.conama_iqar).filter(v => v !== null);

        const avg = arr => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;
        const min = arr => arr.length ? Math.min(...arr) : 0;
        const max = arr => arr.length ? Math.max(...arr) : 0;

        // Adiciona para cálculo global de correlação
        hums.forEach((h, idx) => {
          if (pm25s[idx] !== undefined) {
            correlationSample.humidity.push(h);
            correlationSample.pm2_5.push(pm25s[idx]);
          }
        });

        // Contagem de categorias de qualidade do ar
        const categoryCounts = rows.reduce((acc, curr) => {
          const cat = curr.aqi_category || 'Boa';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {});

        summaryPerCity.push({
          cityId: city.id,
          cityName: city.name,
          readingsCount: rows.length,
          metrics: {
            temperature: { avg: avg(temps), min: min(temps), max: max(temps) },
            humidity: { avg: avg(hums), min: min(hums), max: max(hums) },
            pm2_5: { avg: avg(pm25s), min: min(pm25s), max: max(pm25s) },
            pm10: { avg: avg(pm10s), min: min(pm10s), max: max(pm10s) },
            conamaIqar: { avg: avg(iqars), min: min(iqars), max: max(iqars) }
          },
          airQualityDistribution: categoryCounts
        });
      }
    }

    // Correlação Umidade vs PM2.5 (Geralmente negativa no interior paulista: tempo seco aumenta material particulado)
    const correlation = calculatePearsonCorrelation(
      correlationSample.humidity,
      correlationSample.pm2_5
    );

    let correlationInterpretation = 'Correlação fraca ou neutra.';
    if (correlation < -0.3) {
      correlationInterpretation = 'Correlação negativa moderada a forte: a queda na umidade do ar coincide com a elevação de poluentes (PM2.5), típico de períodos secos na RMC.';
    } else if (correlation > 0.3) {
      correlationInterpretation = 'Correlação positiva observada no período analisado.';
    }

    return res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        citiesSummary: summaryPerCity,
        statisticalInsights: {
          correlationHumidityVsPm25: correlation,
          interpretation: correlationInterpretation,
          criticalPollutant: 'PM2.5 (Material Particulado fino)',
          standardApplied: 'CONAMA 491/2018 (Conselho Nacional do Meio Ambiente)'
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Exporta dados climáticos e de qualidade do ar em CSV ou JSON
 */
async function exportData(req, res) {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const cityId = req.query.cityId || null;

    let query = `
      SELECT 
        c.name as cidade,
        w.recorded_at as data_hora,
        w.temperature as temperatura_c,
        w.relative_humidity as umidade_perc,
        w.wind_speed as vento_kmh,
        w.weather_description as condicao,
        a.pm2_5 as pm2_5_ugm3,
        a.pm10 as pm10_ugm3,
        a.conama_iqar as indice_iqar,
        a.aqi_category as classificacao_ar
      FROM weather_readings w
      JOIN cities c ON c.id = w.city_id
      LEFT JOIN air_quality_readings a 
        ON w.city_id = a.city_id 
        AND strftime('%Y-%m-%d %H', w.recorded_at) = strftime('%Y-%m-%d %H', a.recorded_at)
    `;
    const params = [];

    if (cityId) {
      query += ` WHERE w.city_id = ? `;
      params.push(cityId);
    }

    query += ` ORDER BY w.recorded_at DESC LIMIT 500 `;

    const rows = await dbAll(query, params);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio_clima_rmc.json"');
      return res.send(JSON.stringify(rows, null, 2));
    }

    // Formato CSV
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio_clima_rmc.csv"');

    const headers = [
      'Cidade',
      'Data/Hora',
      'Temperatura (C)',
      'Umidade (%)',
      'Vento (km/h)',
      'Condicao',
      'PM2.5 (ug/m3)',
      'PM10 (ug/m3)',
      'Indice IQAr',
      'Classificacao do Ar'
    ];

    const csvLines = [
      headers.join(';')
    ];

    rows.forEach(r => {
      const line = [
        `"${r.cidade || ''}"`,
        `"${r.data_hora || ''}"`,
        r.temperatura_c ?? '',
        r.umidade_perc ?? '',
        r.vento_kmh ?? '',
        `"${r.condicao || ''}"`,
        r.pm2_5_ugm3 ?? '',
        r.pm10_ugm3 ?? '',
        r.indice_iqar ?? '',
        `"${r.classificacao_ar || ''}"`
      ];
      csvLines.push(line.join(';'));
    });

    return res.send(csvLines.join('\n'));
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAnalysisData,
  exportData
};
