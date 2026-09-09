/**
 * Módulo de Exportação de Relatório Técnico em PDF - ClimaRMC
 * Projeto Integrador em Computação II - DRP04 - Turma 005 / UNIVESP
 * Gera laudo técnico com diagramação A4 para impressão e download em PDF
 */

const ReportPdf = (function () {

  /**
   * Coleta dados atuais da tela e gera o laudo técnico
   */
  async function generateTechnicalReport(cityId = 'campinas') {
    try {
      if (window.A11y) window.A11y.announce('Gerando relatório técnico em PDF da UNIVESP...');

      // 1. Busca dados meteorológicos e IQAr atualizados da cidade
      const weatherRes = await fetch(`/api/weather/${cityId}`);
      const weatherJson = await weatherRes.json();
      const cityData = weatherJson.success ? weatherJson.data : null;

      // 2. Busca dados analíticos do SQLite
      let analysisData = null;
      try {
        const analysisRes = await fetch('/api/analysis');
        const analysisJson = await analysisRes.json();
        if (analysisJson.success) analysisData = analysisJson.data;
      } catch (e) {
        console.warn('Não foi possível carregar estatísticas do SQLite para o relatório:', e);
      }

      if (!cityData) {
        alert('Não foi possível carregar os dados para emissão do relatório.');
        return;
      }

      const cityName = cityData.city?.name || 'Campinas';
      const now = new Date();
      const formattedDate = now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const formattedTime = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const weather = cityData.weather || {};
      const aqi = cityData.airQuality || {};
      const city = cityData.city || {};

      // 3. Monta documento HTML para impressão A4
      const reportHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatorio_Tecnico_ClimaRMC_${cityName}_${now.toISOString().slice(0, 10)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 15mm 18mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11pt;
      padding: 10px;
    }
    .header-table {
      width: 100%;
      border-bottom: 3px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .inst-title {
      font-size: 13pt;
      font-weight: 800;
      color: #0c1a2e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .inst-sub {
      font-size: 10pt;
      color: #0284c7;
      font-weight: 700;
      margin-top: 2px;
    }
    .doc-meta {
      font-size: 8.5pt;
      color: #64748b;
      text-align: right;
    }
    .report-title {
      text-align: center;
      margin: 16px 0 14px 0;
      padding: 8px;
      background: #f1f5f9;
      border-radius: 6px;
      border-left: 4px solid #0284c7;
    }
    .report-title h1 {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
    }
    .report-title p {
      font-size: 9.5pt;
      color: #475569;
      margin-top: 2px;
    }
    h2 {
      font-size: 11pt;
      font-weight: 700;
      color: #0c1a2e;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin: 14px 0 8px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .card-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0369a1;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .data-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 9pt;
      border-bottom: 1px dashed #f1f5f9;
    }
    .data-label {
      color: #475569;
    }
    .data-val {
      font-weight: 700;
      color: #0f172a;
    }
    .badge-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: 700;
      background: #e0f2fe;
      color: #0369a1;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 8.5pt;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
    }
    table.data-table th {
      background: #f1f5f9;
      font-weight: 700;
      color: #334155;
    }
    table.data-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .recommendations-box {
      border-left: 4px solid #10b981;
      background: #f0fdf4;
      padding: 10px 12px;
      border-radius: 4px;
      margin-top: 8px;
      font-size: 9pt;
      color: #166534;
    }
    .footer-sign {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #64748b;
    }
    .print-bar {
      position: sticky;
      top: 0;
      background: #0c1a2e;
      color: #ffffff;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: -10px -10px 16px -10px;
    }
    .btn-print {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
      font-size: 10pt;
    }
    .btn-print:hover {
      background: #0369a1;
    }
    @media print {
      .print-bar {
        display: none !important;
      }
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>

  <!-- Barra de controle visivel apenas em tela -->
  <div class="print-bar">
    <div>
      <strong>Visualização de Relatório Técnico UNIVESP</strong> • Pronto para download
    </div>
    <button class="btn-print" onclick="window.print()">Salvar como PDF / Imprimir</button>
  </div>

  <!-- Cabeçalho Institucional -->
  <table class="header-table">
    <tr>
      <td>
        <div class="inst-title">UNIVESP — Universidade Virtual do Estado de São Paulo</div>
        <div class="inst-sub">Projeto Integrador em Computação II — DRP04 — Turma 005</div>
        <div style="font-size: 8.5pt; color: #475569; margin-top: 3px;">
          Sistema ClimaRMC • Monitoramento Meteorológico e Qualidade do Ar (RMC)
        </div>
      </td>
      <td class="doc-meta">
        <div><strong>Emissão:</strong> ${formattedDate} às ${formattedTime}</div>
        <div><strong>Município:</strong> ${cityName} - SP</div>
        <div><strong>Padrão:</strong> CONAMA 491/2018</div>
      </td>
    </tr>
  </table>

  <!-- Título do Laudo Técnico -->
  <div class="report-title">
    <h1>LAUDO TÉCNICO DE MONITORAMENTO AMBIENTAL E METEOROLÓGICO</h1>
    <p>Região Metropolitana de Campinas (RMC) • Estação Virtual de Referência: ${cityName}</p>
  </div>

  <!-- Informações Gerais e Meteorologia Atual -->
  <div class="grid-2">
    <div class="card">
      <div class="card-title">1. Parâmetros Meteorológicos em Tempo Real</div>
      <div class="data-row">
        <span class="data-label">Temperatura Ambiente:</span>
        <span class="data-val">${weather.temperature !== undefined ? weather.temperature + ' °C' : '--'}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Sensação Térmica:</span>
        <span class="data-val">${weather.apparentTemperature !== undefined ? weather.apparentTemperature + ' °C' : '--'}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Umidade Relativa do Ar:</span>
        <span class="data-val">${weather.humidity !== undefined ? weather.humidity + ' %' : '--'}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Condição Meteorológica:</span>
        <span class="data-val">${weather.condition || 'Estável'}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Velocidade do Vento:</span>
        <span class="data-val">${weather.windSpeed !== undefined ? weather.windSpeed + ' km/h' : '--'}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Pressão Atmosférica:</span>
        <span class="data-val">${weather.surfacePressure !== undefined ? weather.surfacePressure + ' hPa' : '--'}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Radiação Ultravioleta (UV):</span>
        <span class="data-val">${weather.uvIndex !== undefined ? weather.uvIndex + ' (' + (weather.uvInfo?.level || '--') + ')' : '--'}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">2. Qualidade do Ar (IQAr CONAMA 491/2018)</div>
      <div class="data-row">
        <span class="data-label">Índice Global IQAr:</span>
        <span class="data-val"><span class="badge-status" style="background:${aqi.color || '#10b981'}; color:#ffffff;">${aqi.iqarConama ?? 30} — ${aqi.category || 'Boa'}</span></span>
      </div>
      <div class="data-row">
        <span class="data-label">Poluente Determinante:</span>
        <span class="data-val">${aqi.dominantPollutant ? aqi.dominantPollutant.toUpperCase() : 'PM2.5'}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Partículas PM2.5:</span>
        <span class="data-val">${cityData.airQuality?.pollutants?.pm2_5 ?? '--'} µg/m³</span>
      </div>
      <div class="data-row">
        <span class="data-label">Partículas PM10:</span>
        <span class="data-val">${cityData.airQuality?.pollutants?.pm10 ?? '--'} µg/m³</span>
      </div>
      <div class="data-row">
        <span class="data-label">Ozônio Troposférico (O₃):</span>
        <span class="data-val">${cityData.airQuality?.pollutants?.ozone ?? '--'} µg/m³</span>
      </div>
      <div class="data-row">
        <span class="data-label">Dióxido de Nitrogênio (NO₂):</span>
        <span class="data-val">${cityData.airQuality?.pollutants?.nitrogen_dioxide ?? '--'} µg/m³</span>
      </div>
      <div class="data-row">
        <span class="data-label">Monóxido de Carbono (CO):</span>
        <span class="data-val">${cityData.airQuality?.pollutants?.carbon_monoxide ?? '--'} µg/m³</span>
      </div>
    </div>
  </div>

  <!-- Recomendações de Saúde Pública -->
  <h2>3. Parecer Técnico e Orientações à Saúde Pública</h2>
  <div class="recommendations-box">
    <strong>Classificação Atual: ${aqi.category || 'Boa'} (IQAr: ${aqi.iqarConama ?? 30})</strong>
    <p style="margin-top: 4px;">${aqi.recommendation || 'A qualidade do ar é considerada satisfatória e o risco à saúde é nulo ou reduzido para toda a população.'}</p>
    <p style="margin-top: 6px; font-size: 8.5pt; color: #14532d;">
      * Critérios estabelecidos pela Resolução CONAMA nº 491/2018 e diretrizes da Organização Mundial da Saúde (OMS).
    </p>
  </div>

  <!-- Tabela Estatística de Dados Históricos (SQLite) -->
  <h2>4. Resumo Estatístico Consolidado das Cidades Monitoradas</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Município</th>
        <th>Temp. Média</th>
        <th>Umidade Média</th>
        <th>PM2.5 Médio</th>
        <th>PM10 Médio</th>
        <th>IQAr Médio CONAMA</th>
        <th>Amostras (SQLite)</th>
      </tr>
    </thead>
    <tbody>
      ${(analysisData && analysisData.cityStats && analysisData.cityStats.length > 0)
        ? analysisData.cityStats.map(s => `
          <tr>
            <td><strong>${s.cityName}</strong></td>
            <td>${s.avgTemp !== null ? s.avgTemp + ' °C' : '--'} (${s.minTemp ?? '--'} / ${s.maxTemp ?? '--'})</td>
            <td>${s.avgHumidity !== null ? s.avgHumidity + ' %' : '--'}</td>
            <td>${s.avgPm25 !== null ? s.avgPm25 + ' µg/m³' : '--'}</td>
            <td>${s.avgPm10 !== null ? s.avgPm10 + ' µg/m³' : '--'}</td>
            <td>${s.avgAqi !== null ? s.avgAqi : '--'}</td>
            <td>${s.readingsCount} leituras</td>
          </tr>
        `).join('')
        : `<tr><td colspan="7" style="text-align:center;">Sem histórico consolidado no momento.</td></tr>`
      }
    </tbody>
  </table>

  <!-- Correlação Estatística -->
  <div style="margin-top: 10px; font-size: 8.5pt; color: #475569; background: #f8fafc; padding: 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
    <strong>Análise Estatística de Correlação (Pearson):</strong>
    ${analysisData && analysisData.correlation ? `
      Coeficiente r = <strong>${analysisData.correlation.correlationHumidityVsPm25}</strong>.
      ${analysisData.correlation.interpretation}
    ` : 'Correlação em processamento estatístico contínuo.'}
  </div>

  <!-- Rodapé Institucional -->
  <div class="footer-sign">
    <div>
      <strong>Projeto Integrador em Computação II - DRP04 - Turma 005</strong><br>
      UNIVESP • Polo Regional Campinas • Arquitetura Node.js, Express & SQLite
    </div>
    <div style="text-align: right;">
      Documento gerado automaticamente pelo Sistema ClimaRMC<br>
      Autenticidade e integridade verificáveis via API REST (/api/analysis)
    </div>
  </div>

  <script>
    // Dispara a impressao automaticamente apos carregamento
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;

      // 4. Abre a janela do laudo técnico
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(reportHtml);
        printWindow.document.close();
      } else {
        // Fallback se popup for bloqueada
        const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.click();
      }

    } catch (err) {
      console.error('Erro ao gerar relatório técnico em PDF:', err);
      alert('Erro ao gerar relatório técnico em PDF. Verifique a conexão com o servidor.');
    }
  }

  return {
    generateTechnicalReport
  };
})();

// Exporta para escopo global
window.ReportPdf = ReportPdf;
