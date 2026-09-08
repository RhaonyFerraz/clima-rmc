/**
 * Configuração Swagger/OpenAPI 3.0 — ClimaRMC
 * Documentação interativa de todos os endpoints da API REST
 */
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ClimaRMC API',
      version: '1.0.0',
      description: `
## Sistema de Monitoramento Climático e Qualidade do Ar — RMC

API REST completa para consulta de dados meteorológicos e de qualidade do ar das cidades de
**Campinas**, **Sumaré** e **Hortolândia**, integrantes da Região Metropolitana de Campinas (SP).

### Fontes de Dados
- **Clima e UV**: [Open-Meteo](https://open-meteo.com/) — API gratuita e sem chave
- **Qualidade do Ar**: [Open-Meteo Air Quality API](https://air-quality-api.open-meteo.com/)
- **Classificação IQAr**: Resolução CONAMA nº 491/2018 / CETESB SP

### Banco de Dados
Leituras históricas persistidas localmente em **SQLite** com sincronização a cada hora via cron job.

### Trabalho Acadêmico
Desenvolvido como projeto de Software para a disciplina de Desenvolvimento Web na Faculdade — 2026.
      `.trim(),
      contact: {
        name: 'ClimaRMC',
        url: 'http://localhost:3000'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de Desenvolvimento Local'
      }
    ],
    tags: [
      { name: 'Cidades', description: 'Consulta das cidades monitoradas da RMC' },
      { name: 'Clima e Ar', description: 'Dados meteorológicos e de qualidade do ar em tempo real' },
      { name: 'Histórico', description: 'Séries temporais do banco de dados SQLite' },
      { name: 'Análise', description: 'Indicadores estatísticos e exportação de relatórios' },
      { name: 'Sistema', description: 'Saúde e sincronização do sistema' }
    ],
    components: {
      schemas: {
        City: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'campinas', description: 'Identificador único da cidade' },
            name: { type: 'string', example: 'Campinas' },
            state: { type: 'string', example: 'SP' },
            latitude: { type: 'number', format: 'float', example: -22.9056 },
            longitude: { type: 'number', format: 'float', example: -47.0608 },
            elevation: { type: 'number', example: 685, description: 'Altitude em metros' },
            population: { type: 'integer', example: 1213792 },
            description: { type: 'string', example: 'Maior cidade da RMC e polo tecnológico e universitário do interior paulista.' }
          }
        },
        WeatherData: {
          type: 'object',
          properties: {
            city: { '$ref': '#/components/schemas/City' },
            timestamp: { type: 'string', example: '2026-09-08T15:00' },
            weather: {
              type: 'object',
              properties: {
                temperature: { type: 'number', example: 22.3, description: 'Temperatura atual em °C' },
                apparentTemperature: { type: 'number', example: 21.8, description: 'Sensação térmica em °C' },
                humidity: { type: 'integer', example: 70, description: 'Umidade relativa em %' },
                precipitation: { type: 'number', example: 0, description: 'Precipitação atual em mm' },
                windSpeed: { type: 'number', example: 12.5, description: 'Velocidade do vento em km/h' },
                windGusts: { type: 'number', example: 22.1, description: 'Rajadas de vento em km/h' },
                windDirection: { type: 'integer', example: 225, description: 'Direção do vento em graus (0–360)' },
                windCardinal: {
                  type: 'object',
                  properties: {
                    abbr: { type: 'string', example: 'SO' },
                    label: { type: 'string', example: 'Sudoeste' }
                  }
                },
                uvIndex: { type: 'number', example: 3.5, description: 'Índice UV atual (escala OMS)' },
                uvInfo: {
                  type: 'object',
                  properties: {
                    level: { type: 'string', example: 'Moderado', enum: ['Baixo', 'Moderado', 'Alto', 'Muito Alto', 'Extremo'] },
                    color: { type: 'string', example: '#f59e0b' },
                    tip: { type: 'string', example: 'Protetor solar FPS 30+ e boné recomendados.' }
                  }
                },
                surfacePressure: { type: 'number', example: 930.5, description: 'Pressão atmosférica em hPa' },
                condition: { type: 'string', example: 'Parcialmente nublado' },
                icon: { type: 'string', example: '⛅' }
              }
            },
            airQuality: {
              type: 'object',
              properties: {
                pm2_5: { type: 'number', example: 7.2, description: 'Partículas finas PM2.5 em µg/m³' },
                pm10: { type: 'number', example: 12.4, description: 'Partículas grossas PM10 em µg/m³' },
                ozone: { type: 'number', example: 97.0, description: 'Ozônio troposférico em µg/m³' },
                nitrogenDioxide: { type: 'number', example: 4.9, description: 'Dióxido de nitrogênio em µg/m³' },
                sulphurDioxide: { type: 'number', example: 2.6, description: 'Dióxido de enxofre em µg/m³' },
                carbonMonoxide: { type: 'number', example: 295, description: 'Monóxido de carbono em µg/m³' },
                europeanAqi: { type: 'integer', example: 39, description: 'Índice Europeu de Qualidade do Ar (EAQI)' },
                iqarConama: { type: 'integer', example: 39, description: 'Índice de Qualidade do Ar — Resolução CONAMA 491/2018' },
                category: { type: 'string', example: 'Boa', enum: ['Boa', 'Moderada', 'Ruim', 'Muito Ruim', 'Péssima'] },
                color: { type: 'string', example: '#10b981', description: 'Cor hexadecimal representando a faixa de risco' },
                recommendation: { type: 'string', example: 'A qualidade do ar é considerada satisfatória.' }
              }
            },
            alerts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  alert_type: { type: 'string', example: 'LOW_HUMIDITY', enum: ['LOW_HUMIDITY', 'HEAT_WAVE', 'AIR_QUALITY', 'RAIN'] },
                  severity: { type: 'string', example: 'WARNING', enum: ['INFO', 'WARNING', 'DANGER'] },
                  title: { type: 'string', example: 'Estado de Atenção: Baixa Umidade' },
                  message: { type: 'string', example: 'A umidade em Campinas está em 28%. Mantenha-se hidratado.' }
                }
              }
            }
          }
        },
        HistorySeries: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            period: {
              type: 'object',
              properties: {
                hours: { type: 'integer', example: 24 },
                label: { type: 'string', example: 'Últimas 24h' }
              }
            },
            count: { type: 'integer', example: 10, description: 'Total de leituras no período' },
            series: {
              type: 'object',
              description: 'Séries temporais prontas para Chart.js',
              properties: {
                labels: { type: 'array', items: { type: 'string' }, example: ['14:00', '15:00', '16:00'] },
                temperature: { type: 'array', items: { type: 'number' }, example: [22.3, 23.1, 21.8] },
                humidity: { type: 'array', items: { type: 'integer' }, example: [68, 65, 72] },
                iqar: { type: 'array', items: { type: 'integer' }, example: [30, 35, 28] },
                pm2_5: { type: 'array', items: { type: 'number' }, example: [5.2, 6.1, 4.9] },
                pm10: { type: 'array', items: { type: 'number' }, example: [8.4, 9.1, 7.6] }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Cidade com ID "xyz" não encontrada.' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
