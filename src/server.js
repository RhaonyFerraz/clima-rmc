require('dotenv').config();
const app = require('./app');
const { initDatabase } = require('./config/database');
const { startSyncScheduler } = require('./services/syncJob');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('====================================================');
    console.log('  Iniciando ClimaRMC - Monitoramento Clima e Ar RMC ');
    console.log('====================================================');

    // 1. Inicializa o banco de dados SQLite
    await initDatabase();
    console.log('[OK] Banco de dados SQLite inicializado.');

    // 2. Inicia o agendador de sincronização
    startSyncScheduler();
    console.log('[OK] Agendador de sincronização e monitoramento ativado.');

    // 3. Inicia o servidor HTTP
    const server = app.listen(PORT, () => {
      console.log(`[OK] Servidor ClimaRMC rodando em http://localhost:${PORT}`);
      console.log(`     API Docs / Rotas em http://localhost:${PORT}/api/cities`);
      console.log(`     Status do Sistema em http://localhost:${PORT}/health`);
    });

    // Encerramento gracioso
    process.on('SIGINT', () => {
      console.log('\n[INFO] Encerrando servidor ClimaRMC...');
      server.close(() => {
        console.log('[INFO] Servidor finalizado com sucesso.');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('[ERRO FATAL] Falha ao iniciar aplicação:', error);
    process.exit(1);
  }
}

startServer();
