(() => {
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  if (standalone) document.documentElement.classList.add('pwa-standalone');
  const splash = document.getElementById('pwaSplash');
  const status = document.getElementById('pwaStatus');

  const hideSplash = () => {
    if (!splash || splash.hidden) return;
    splash.classList.add('is-hiding');
    window.setTimeout(() => { splash.hidden = true; }, 220);
  };

  if (standalone) {
    // Show the animated logo long enough to cover the short Home Screen launch delay.
    window.addEventListener('load', () => window.setTimeout(hideSplash, 650), { once: true });
    window.setTimeout(hideSplash, 2200);
  } else if (splash) {
    splash.hidden = true;
  }

  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      // Check for a newer service worker each time the editor opens.
      registration.update().catch(() => {});
      if (status && standalone && !navigator.onLine) {
        status.textContent = 'Offline mode';
        status.hidden = false;
        window.setTimeout(() => { status.hidden = true; }, 1800);
      }
    } catch (error) {
      console.warn('PWA service worker could not be registered.', error);
    }
  }, { once: true });
})();
