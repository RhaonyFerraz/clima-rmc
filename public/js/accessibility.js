/**
 * Módulo de Acessibilidade - ClimaRMC
 * Conformidade com as diretrizes WCAG 2.1 (Nível AA)
 */

(function () {
  const STORAGE_KEY_CONTRAST = 'clima_rmc_high_contrast';
  const STORAGE_KEY_THEME = 'clima_rmc_theme';
  const STORAGE_KEY_FONT_SIZE = 'clima_rmc_font_size_level';

  let currentFontLevel = parseInt(localStorage.getItem(STORAGE_KEY_FONT_SIZE), 10) || 0; // -1, 0, 1, 2, 3
  const fontMultipliers = [0.875, 1.0, 1.125, 1.25, 1.4];

  // Elemento para anúncios a leitores de tela
  let liveRegion = null;

  function initAccessibility() {
    liveRegion = document.getElementById('a11y-live-announcer');

    // 1. Aplica Alto Contraste salvo
    const isHighContrast = localStorage.getItem(STORAGE_KEY_CONTRAST) === 'true';
    if (isHighContrast) {
      document.body.classList.add('high-contrast');
      updateContrastBtnState(true);
    }

    // 2. Aplica Tema salvo (Claro / Escuro)
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
    if (savedTheme === 'light') {
      document.body.classList.add('theme-light');
      updateThemeBtnState('light');
    }

    // 3. Aplica Escala de Fonte salva
    applyFontSize(currentFontLevel);

    // 4. Conecta os eventos dos botões de acessibilidade
    const btnContrast = document.getElementById('btn-contrast');
    if (btnContrast) {
      btnContrast.addEventListener('click', toggleHighContrast);
    }

    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
      btnTheme.addEventListener('click', toggleTheme);
    }

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

  function toggleHighContrast() {
    const isNowHighContrast = document.body.classList.toggle('high-contrast');
    localStorage.setItem(STORAGE_KEY_CONTRAST, isNowHighContrast ? 'true' : 'false');
    updateContrastBtnState(isNowHighContrast);
    announceToScreenReader(isNowHighContrast ? 'Modo de alto contraste ativado.' : 'Modo de alto contraste desativado.');
  }

  function updateContrastBtnState(active) {
    const btn = document.getElementById('btn-contrast');
    if (btn) {
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.innerHTML = active ? '☀️ Contraste Normal' : '👁️ Alto Contraste';
    }
  }

  function toggleTheme() {
    const isLight = document.body.classList.toggle('theme-light');
    const theme = isLight ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    updateThemeBtnState(theme);
    announceToScreenReader(`Tema alternado para modo ${isLight ? 'claro' : 'escuro'}.`);
  }

  function updateThemeBtnState(theme) {
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.innerHTML = theme === 'light' ? '🌙 Modo Escuro' : '☀️ Modo Claro';
      btn.setAttribute('aria-label', `Mudar para tema ${theme === 'light' ? 'escuro' : 'claro'}`);
    }
  }

  function changeFontSize(delta) {
    const newLevel = Math.max(0, Math.min(fontMultipliers.length - 1, currentFontLevel + 1 * delta));
    if (newLevel !== currentFontLevel) {
      currentFontLevel = newLevel;
      localStorage.setItem(STORAGE_KEY_FONT_SIZE, currentFontLevel);
      applyFontSize(currentFontLevel);
      announceToScreenReader(`Tamanho de texto alterado.`);
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
