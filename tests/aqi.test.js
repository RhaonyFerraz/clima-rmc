const {
  calculateSubIndex,
  classifyConamaAQI,
  calculateOverallAQI,
  getWeatherInterpretation
} = require('../src/services/aqiService');

describe('Testes Unitários - aqiService (Resolução CONAMA nº 491/2018)', () => {
  describe('calculateSubIndex()', () => {
    test('deve calcular índice na faixa "Boa" para PM2.5 baixo', () => {
      const index = calculateSubIndex(15, 'pm2_5');
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(40);
    });

    test('deve calcular índice na faixa "Moderada" para PM2.5 intermediário', () => {
      const index = calculateSubIndex(35, 'pm2_5');
      expect(index).toBeGreaterThanOrEqual(41);
      expect(index).toBeLessThanOrEqual(80);
    });

    test('deve retornar 0 para valores nulos ou inválidos', () => {
      expect(calculateSubIndex(null, 'pm2_5')).toBe(0);
      expect(calculateSubIndex(undefined, 'pm2_5')).toBe(0);
      expect(calculateSubIndex(NaN, 'pm2_5')).toBe(0);
    });
  });

  describe('classifyConamaAQI()', () => {
    test('índice <= 40 deve ser classificado como "Boa"', () => {
      const res = classifyConamaAQI(25);
      expect(res.category).toBe('Boa');
      expect(res.level).toBe(1);
      expect(res.color).toBe('#10b981');
    });

    test('índice entre 41 e 80 deve ser "Moderada"', () => {
      const res = classifyConamaAQI(65);
      expect(res.category).toBe('Moderada');
      expect(res.level).toBe(2);
    });

    test('índice entre 81 e 120 deve ser "Ruim"', () => {
      const res = classifyConamaAQI(95);
      expect(res.category).toBe('Ruim');
      expect(res.level).toBe(3);
    });

    test('índice entre 121 e 200 deve ser "Muito Ruim"', () => {
      const res = classifyConamaAQI(150);
      expect(res.category).toBe('Muito Ruim');
      expect(res.level).toBe(4);
    });

    test('índice > 200 deve ser "Péssima"', () => {
      const res = classifyConamaAQI(250);
      expect(res.category).toBe('Péssima');
      expect(res.level).toBe(5);
    });
  });

  describe('calculateOverallAQI()', () => {
    test('deve considerar o poluente de maior impacto como determinante', () => {
      const result = calculateOverallAQI({
        pm2_5: 10,  // Faixa Boa
        pm10: 120,  // Faixa Ruim
        ozone: 20   // Faixa Boa
      });

      expect(result.dominantPollutant).toBe('pm10');
      expect(result.category).toBe('Ruim');
    });
  });

  describe('getWeatherInterpretation()', () => {
    test('deve traduzir código WMO 0 para céu limpo com ícone de sol', () => {
      const info = getWeatherInterpretation(0);
      expect(info.description).toBe('Céu limpo');
      expect(info.icon).toBe('☀️');
    });

    test('deve traduzir código WMO 95 para tempestade', () => {
      const info = getWeatherInterpretation(95);
      expect(info.description).toBe('Tempestade com trovoadas');
      expect(info.icon).toBe('⛈️');
    });

    test('deve retornar padrão seguro para códigos desconhecidos', () => {
      const info = getWeatherInterpretation(9999);
      expect(info.description).toBe('Instável');
    });
  });
});
