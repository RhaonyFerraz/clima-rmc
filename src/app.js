const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const apiRoutes = require('./routes/api');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivos estáticos (Interface Web acessível)
app.use(express.static(path.join(__dirname, '../public')));

// Health check para monitoramento em nuvem
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'ClimaRMC - Monitoramento Meteorológico e Qualidade do Ar'
  });
});

// ====================================================
// Swagger UI — Documentação Interativa da API
// Acesse em: /api/docs
// ====================================================
const swaggerUiOptions = {
  customSiteTitle: 'ClimaRMC — API Docs',
  customCss: `
    .swagger-ui .topbar { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .info .title { color: #0284c7; }
    .swagger-ui .btn.authorize { border-color: #0284c7; color: #0284c7; }
    body { font-family: 'Inter', system-ui, sans-serif; }
  `,
  customfavIcon: '/icons/icon.svg',
  swaggerOptions: {
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    docExpansion: 'list',
    filter: true,
    displayRequestDuration: true
  }
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Expõe o JSON bruto da spec OpenAPI para integrações externas
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Rotas da API REST
app.use('/api', apiRoutes);

// Fallback para SPA / index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint não encontrado na API.' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Middleware centralizado de tratamento de erros
app.use((err, req, res, next) => {
  console.error('[ERRO SERVIDOR]', err.stack);
  res.status(500).json({
    success: false,
    error: 'Ocorreu um erro interno no servidor ClimaRMC.',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
