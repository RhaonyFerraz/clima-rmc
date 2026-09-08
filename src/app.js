const express = require('express');
const cors = require('cors');
const path = require('path');
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
