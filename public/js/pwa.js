/**
 * Módulo de Gerenciamento do PWA - ClimaRMC
 * Registro de Service Worker, instalação no celular/desktop e controle offline
 */

(function () {
  let deferredPrompt = null;

  function initPWA() {
    registerServiceWorker();
    setupInstallPrompt();
    setupOfflineDetection();
    checkUrlShortcuts();
  }

  /**
   * 1. Registra o Service Worker para cache e suporte offline
   */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registrado com sucesso:', registration.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Falha ao registrar Service Worker:', err);
          });
      });
    }
  }

  /**
   * 2. Captura o evento de instalação (beforeinstallprompt)
   */
  function setupInstallPrompt() {
    const installBtn = document.getElementById('btn-pwa-install');
    if (!installBtn) return;

    window.addEventListener('beforeinstallprompt', (e) => {
      // Previne o prompt automático padrão do navegador
      e.preventDefault();
      deferredPrompt = e;

      // Exibe o botão de instalação com animação
      installBtn.style.display = 'inline-flex';

      installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;

        // Dispara o diálogo oficial de instalação do sistema operacional
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA] Usuário respondeu ao prompt de instalação: ${outcome}`);

        // Limpa o prompt e oculta o botão
        deferredPrompt = null;
        installBtn.style.display = 'none';
      });
    });

    // Detecta se o aplicativo já foi instalado
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] ClimaRMC instalado com sucesso no dispositivo!');
      installBtn.style.display = 'none';
    });
  }

  /**
   * 3. Detecção de status online / offline com aviso visual
   */
  function setupOfflineDetection() {
    const toast = document.getElementById('offline-toast');
    if (!toast) return;

    function updateOnlineStatus() {
      if (navigator.onLine) {
        toast.style.display = 'none';
      } else {
        toast.style.display = 'block';
      }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Verificação inicial
    if (!navigator.onLine) {
      toast.style.display = 'block';
    }
  }

  /**
   * 4. Suporte a atalhos do PWA (App Shortcuts) via URL query params
   */
  function checkUrlShortcuts() {
    const urlParams = new URLSearchParams(window.location.search);
    const cityParam = urlParams.get('city');
    if (cityParam) {
      const validCities = ['campinas', 'sumare', 'hortolandia'];
      if (validCities.includes(cityParam.toLowerCase())) {
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            const tab = document.querySelector(`.city-tab[data-city="${cityParam.toLowerCase()}"]`);
            if (tab) tab.click();
          }, 300);
        });
      }
    }
  }

  initPWA();
})();
