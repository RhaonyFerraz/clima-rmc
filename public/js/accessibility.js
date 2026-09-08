/**
 * Módulo de Acessibilidade - ClimaRMC
 * Conformidade com as diretrizes WCAG 2.1 (Nível AA)
 * Focado em redimensionamento tipográfico e compatibilidade com leitores de tela
 */

(function () {
  const STORAGE_KEY_FONT_SIZE = 'clima_rmc_font_size_level';

  let currentFontLevel = parseInt(localStorage.getItem(STORAGE_KEY_FONT_SIZE), 10);
  if (isNaN(currentFontLevel) || currentFontLevel < 0 || currentFontLevel > 4) {
    currentFontLevel = 1; // Padrão 1.0rem
  }

  const fontMultipliers = [0.875, 1.0, 1.125, 1.25, 1.4];
  let liveRegion = null;

  function initAccessibility() {
    liveRegion = document.getElementById('a11y-live-announcer');

    // Aplica Escala de Fonte salva
    applyFontSize(currentFontLevel);

    // Conecta botões de tamanho de fonte
    const btnFontInc = document.getElementById('btn-font-inc');
    if (btnFontInc) {
      btnFontInc.addEventListener('click', () => changeFontSize(1));
    }

    const btnFontDec = document.getElementById('btn-font-dec');
    if (btnFontDec) {
      btnFontDec.addEventListener('click', () => changeFontSize(-1));
    }

    const btnFontReset = document.getElementById('btn-font-reset');
    if (btnFontReset) {
      btnFontReset.addEventListener('click', () => resetFontSize());
    }
  }

  function changeFontSize(delta) {
    const newLevel = Math.max(0, Math.min(fontMultipliers.length - 1, currentFontLevel + delta));
    if (newLevel !== currentFontLevel) {
      currentFontLevel = newLevel;
      localStorage.setItem(STORAGE_KEY_FONT_SIZE, currentFontLevel);
      applyFontSize(currentFontLevel);
      announceToScreenReader('Tamanho de texto ajustado.');
    }
  }

  function resetFontSize() {
    currentFontLevel = 1; // 1.0rem
    localStorage.setItem(STORAGE_KEY_FONT_SIZE, currentFontLevel);
    applyFontSize(currentFontLevel);
    announceToScreenReader('Tamanho de texto restaurado para o padrão.');
  }

  function applyFontSize(levelIndex) {
    const multiplier = fontMultipliers[levelIndex] || 1.0;
    document.documentElement.style.fontSize = `${multiplier * 16}px`;
  }

  /**
   * Transmite mensagens em áudio para leitores de tela via ARIA live region
   */
  function announceToScreenReader(message) {
    if (!liveRegion) {
      liveRegion = document.getElementById('a11y-live-announcer');
    }
    if (liveRegion) {
      liveRegion.textContent = '';
      setTimeout(() => {
        liveRegion.textContent = message;
      }, 100);
    }
  }

  // Exporta para escopo global
  window.A11y = {
    init: initAccessibility,
    announce: announceToScreenReader
  };

  document.addEventListener('DOMContentLoaded', initAccessibility);
})();
