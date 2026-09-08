/**
 * Serviço de Cálculo e Classificação da Qualidade do Ar
 * Baseado na Resolução CONAMA nº 491/2018 e nos padrões da CETESB para o Estado de São Paulo (RMC)
 */

// Tabela de breakpoints para cálculo de índice linear por poluente (CONAMA 491/2018)
// Faixas: Boa (0-40), Moderada (41-80), Ruim (81-120), Muito Ruim (121-200), Péssima (>200)
const BREAKPOINTS = {
  pm2_5: [
    { cLow: 0, cHigh: 25, iLow: 0, iHigh: 40, category: 'Boa' },
    { cLow: 25.1, cHigh: 50, iLow: 41, iHigh: 80, category: 'Moderada' },
    { cLow: 50.1, cHigh: 75, iLow: 81, iHigh: 120, category: 'Ruim' },
    { cLow: 75.1, cHigh: 125, iLow: 121, iHigh: 200, category: 'Muito Ruim' },
    { cLow: 125.1, cHigh: 300, iLow: 201, iHigh: 300, category: 'Péssima' }
  ],
  pm10: [
    { cLow: 0, cHigh: 50, iLow: 0, iHigh: 40, category: 'Boa' },
    { cLow: 50.1, cHigh: 100, iLow: 41, iHigh: 80, category: 'Moderada' },
    { cLow: 100.1, cHigh: 150, iLow: 81, iHigh: 120, category: 'Ruim' },
    { cLow: 150.1, cHigh: 250, iLow: 121, iHigh: 200, category: 'Muito Ruim' },
    { cLow: 250.1, cHigh: 600, iLow: 201, iHigh: 300, category: 'Péssima' }
  ],
  ozone: [
    { cLow: 0, cHigh: 100, iLow: 0, iHigh: 40, category: 'Boa' },
    { cLow: 100.1, cHigh: 130, iLow: 41, iHigh: 80, category: 'Moderada' },
    { cLow: 130.1, cHigh: 160, iLow: 81, iHigh: 120, category: 'Ruim' },
    { cLow: 160.1, cHigh: 200, iLow: 121, iHigh: 200, category: 'Muito Ruim' },
    { cLow: 200.1, cHigh: 800, iLow: 201, iHigh: 300, category: 'Péssima' }
  ]
};

/**
 * Realiza interpolação linear padrão EPA / CONAMA para calcular o índice
 * I = [ (I_high - I_low) / (C_high - C_low) ] * (C - C_low) + I_low
 */
function calculateSubIndex(concentration, pollutantKey) {
  if (concentration === null || concentration === undefined || isNaN(concentration)) {
    return 0;
  }

  const table = BREAKPOINTS[pollutantKey];
  if (!table) return 0;

  const validConc = Math.max(0, Number(concentration));

  for (const bp of table) {
    if (validConc <= bp.cHigh) {
      const index = ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (validConc - bp.cLow) + bp.iLow;
      return Math.round(index);
    }
  }

  // Acima do limite superior
  const lastBp = table[table.length - 1];
  return Math.min(300, Math.round(lastBp.iHigh + (validConc - lastBp.cHigh) * 0.5));
}

/**
 * Classifica o índice na escala CETESB/CONAMA e retorna recomendações de saúde
 */
function classifyConamaAQI(indexValue) {
  if (indexValue <= 40) {
    return {
      index: indexValue,
      category: 'Boa',
      level: 1,
      color: '#10b981', // Verde
      bgClass: 'aqi-good',
      recommendation: 'A qualidade do ar é considerada satisfatória. Excelente para atividades e exercícios ao ar livre.'
    };
  } else if (indexValue <= 80) {
    return {
      index: indexValue,
      category: 'Moderada',
      level: 2,
      color: '#f59e0b', // Amarelo
      bgClass: 'aqi-moderate',
      recommendation: 'Pessoas com doenças respiratórias crônicas (como asma) podem apresentar sintomas leves. População geral não afetada.'
    };
  } else if (indexValue <= 120) {
    return {
      index: indexValue,
      category: 'Ruim',
      level: 3,
      color: '#f97316', // Laranja
      bgClass: 'aqi-bad',
      recommendation: 'Grupos sensíveis (crianças, idosos e cardíacos/asmáticos) devem reduzir atividades físicas intensas ao ar livre.'
    };
  } else if (indexValue <= 200) {
    return {
      index: indexValue,
      category: 'Muito Ruim',
      level: 4,
      color: '#ef4444', // Vermelho
      bgClass: 'aqi-very-bad',
      recommendation: 'Toda a população pode manifestar sintomas de tosse e irritação nos olhos. Evite exercícios físicos ao ar livre.'
    };
  } else {
    return {
      index: indexValue,
      category: 'Péssima',
      level: 5,
      color: '#7c3aed', // Roxo
      bgClass: 'aqi-hazardous',
      recommendation: 'Condição crítica de emergência. Mantenha janelas fechadas e permaneça em ambientes fechados com purificação de ar.'
    };
  }
}

/**
 * Calcula o IQAr global a partir do maior subíndice (poluente crítico)
 */
function calculateOverallAQI(pollutants = {}) {
  const pm25Index = calculateSubIndex(pollutants.pm2_5, 'pm2_5');
  const pm10Index = calculateSubIndex(pollutants.pm10, 'pm10');
  const ozoneIndex = calculateSubIndex(pollutants.ozone, 'ozone');

  // O índice final é determinado pelo poluente que apresentou o maior impacto
  const maxIndex = Math.max(pm25Index, pm10Index, ozoneIndex, 10);
  const classification = classifyConamaAQI(maxIndex);

  let dominantPollutant = 'pm2_5';
  if (pm10Index > pm25Index && pm10Index >= ozoneIndex) dominantPollutant = 'pm10';
  if (ozoneIndex > pm25Index && ozoneIndex > pm10Index) dominantPollutant = 'ozone';

  return {
    ...classification,
    dominantPollutant,
    subIndices: {
      pm2_5: pm25Index,
      pm10: pm10Index,
      ozone: ozoneIndex
    }
  };
}

/**
 * Converte códigos meteorológicos da OMM (WMO Weather interpretation codes)
 */
function getWeatherInterpretation(code) {
  const codeMap = {
    0: { description: 'Céu limpo', icon: '☀️' },
    1: { description: 'Predomínio de sol', icon: '🌤️' },
    2: { description: 'Parcialmente nublado', icon: '⛅' },
    3: { description: 'Nublado', icon: '☁️' },
    45: { description: 'Nevoeiro', icon: '🌫️' },
    48: { description: 'Nevoeiro com formação de gelo', icon: '🌫️' },
    51: { description: 'Garoa leve', icon: '🌦️' },
    53: { description: 'Garoa moderada', icon: '🌦️' },
    55: { description: 'Garoa densa', icon: '🌧️' },
    61: { description: 'Chuva fraca', icon: '🌧️' },
    63: { description: 'Chuva moderada', icon: '🌧️' },
    65: { description: 'Chuva forte', icon: '🌧️' },
    80: { description: 'Pancadas de chuva leves', icon: '🌦️' },
    81: { description: 'Pancadas de chuva moderadas', icon: '🌧️' },
    82: { description: 'Pancadas de chuva torrenciais', icon: '⛈️' },
    95: { description: 'Tempestade com trovoadas', icon: '⛈️' },
    96: { description: 'Tempestade com granizo leve', icon: '⛈️' },
    99: { description: 'Tempestade severa com granizo', icon: '⛈️' }
  };

  return codeMap[code] || { description: 'Instável', icon: '🌤️' };
}

module.exports = {
  calculateSubIndex,
  classifyConamaAQI,
  calculateOverallAQI,
  getWeatherInterpretation
};
