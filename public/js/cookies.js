/* Cookie Consent Manager

- Manages consent for optional cookie categories (analytics, ads)
- Persists preferences to localStorage
- Exposes API: CookieConsent.acceptAll(), rejectAll(), setConsent(), isConsented(), loadOptionalScripts()
- Binds to DOM controls using data attributes (see README below)
- Loads Google Analytics (gtag) and Google AdSense only when consent is granted

Usage (HTML examples):
<button data-consent-action="accept-all">Accept all</button>
<button data-consent-action="reject-all">Reject all</button>
<input type="checkbox" data-consent-toggle="analytics">
<input type="checkbox" data-consent-toggle="ads">

Optional meta tags to provide IDs (defaults used if missing):
<meta name="analytics-id" content="G-TY93G06DLP">
<meta name="adsense-client" content="ca-pub-XXXXXXXXXXXXX">
*/

(function (window, document) {
  const STORAGE_KEY = 'cookieConsent:v1';
  const DEFAULTS = { necessary: true, analytics: false, ads: false };
  const ANALYTICS_ID = document.querySelector('meta[name="analytics-id"]')?.content || 'G-TY93G06DLP';
  const ADSENSE_CLIENT = document.querySelector('meta[name="adsense-client"]')?.content || null;

  // Internal state
  let consent = loadConsent();

  // Helpers
  function saveConsent() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    dispatchChange();
  }

  function loadConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    } catch (e) {
      console.warn('CookieConsent: failed to load consent, using defaults', e);
      return { ...DEFAULTS };
    }
  }

  function dispatchChange() {
    window.dispatchEvent(new CustomEvent('cookieConsentChange', { detail: { consent } }));
  }

  function isConsented(category) {
    if (category === 'necessary') return true;
    return !!consent[category];
  }

  function setConsent(newConsent = {}) {
    consent = { ...consent, ...newConsent };
    saveConsent();
    applyConsent();
    return consent;
  }

  function acceptAll() {
    setConsent({ analytics: true, ads: true });
  }

  function rejectAll() {
    setConsent({ analytics: false, ads: false });
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    consent = { ...DEFAULTS };
    dispatchChange();
  }

  // Analytics (gtag) loader / toggles
  function disableGtagIfNeeded() {
    try {
      // Disable flag should be set for GA4 measurement ID
      if (!isConsented('analytics')) {
        window['ga-disable-' + ANALYTICS_ID] = true;
        if (typeof window.gtag === 'function') {
          window.gtag('consent', 'update', { analytics_storage: 'denied' });
        }
      }
    } catch (e) {
      console.warn('CookieConsent: disableGtagIfNeeded error', e);
    }
  }

  function ensureGtagLoaded() {
    // If already loaded and consent granted, update consent
    if (typeof window.gtag === 'function') {
      try {
        window.gtag('consent', 'update', { analytics_storage: 'granted' });
        window.gtag('config', ANALYTICS_ID);
      } catch (e) {
        console.warn('CookieConsent: gtag update failed', e);
      }
      return Promise.resolve();
    }

    // If there's a script tag already in the document but gtag isn't ready, try to wait for it
    const existing = document.querySelector("script[src*='googletagmanager.com/gtag/js']");
    if (existing) {
      return new Promise((resolve) => {
        existing.addEventListener('load', () => {
          try {
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);} // eslint-disable-line no-inner-declarations
            window.gtag = window.gtag || function(){dataLayer.push(arguments);};
            window.gtag('js', new Date());
            window.gtag('config', ANALYTICS_ID);
            window.gtag('consent', 'update', { analytics_storage: 'granted' });
          } catch (e) { console.warn('CookieConsent: gtag init after existing script', e); }
          resolve();
        });
      });
    }

    // Otherwise create the script tag
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}`;
      s.onload = () => {
        try {
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){dataLayer.push(arguments);} ;
          window.gtag('js', new Date());
          window.gtag('config', ANALYTICS_ID);
          window.gtag('consent', 'update', { analytics_storage: 'granted' });
        } catch (e) { console.warn('CookieConsent: gtag init', e); }
        resolve();
      };
      s.onerror = (e) => { console.warn('CookieConsent: failed to load gtag script', e); reject(e); };
      document.head.appendChild(s);
    });
  }

  // AdSense loader
  function ensureAdsenseLoaded() {
    if (!ADSENSE_CLIENT) {
      // No client id configured, nothing to do
      return Promise.resolve();
    }

    // If adsbygoogle already present, allow it
    if (window.adsbygoogle) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.async = true;
      s.setAttribute('data-ad-client', ADSENSE_CLIENT);
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      s.onload = () => {
        try {
          // Initialize if needed
          window.adsbygoogle = window.adsbygoogle || [];
        } catch (e) { /* noop */ }
        resolve();
      };
      s.onerror = (e) => { console.warn('CookieConsent: failed to load adsense', e); reject(e); };
      document.head.appendChild(s);
    });
  }

  // Load optional scripts based on consent
  async function loadOptionalScripts() {
    // Analytics
    if (isConsented('analytics')) {
      try {
        await ensureGtagLoaded();
      } catch (e) { console.warn('CookieConsent: load analytics failed', e); }
    } else {
      disableGtagIfNeeded();
    }

    // Ads
    if (isConsented('ads')) {
      try {
        await ensureAdsenseLoaded();
      } catch (e) { console.warn('CookieConsent: load ads failed', e); }
    }

    window.dispatchEvent(new CustomEvent('cookieOptionalLoaded', { detail: { consent } }));
  }

  // DOM binding for common controls
  function bindControls() {
    // Accept all
    document.querySelectorAll('[data-consent-action="accept-all"]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); acceptAll(); loadOptionalScripts(); updateUI(); });
    });

    // Reject all
    document.querySelectorAll('[data-consent-action="reject-all"]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); rejectAll(); updateUI(); });
    });

    // Open settings (let caller show their modal)
    document.querySelectorAll('[data-consent-action="open-settings"]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('cookieOpenSettings')); });
    });

    // Toggles
    document.querySelectorAll('[data-consent-toggle]').forEach(input => bindToggle(input));
  }

  function bindToggle(input) {
    if (!input || input.__cookieBound) return;
    input.__cookieBound = true;
    const cat = input.getAttribute('data-consent-toggle');
    // initialize state
    if (input.type === 'checkbox') {
      input.checked = !!consent[cat];
    }
    input.addEventListener('change', () => {
      const val = (input.type === 'checkbox') ? input.checked : input.value;
      setConsent({ [cat]: !!val });
      loadOptionalScripts();
      updateUI();
    });
  }

  function updateUI() {
    // Update toggles if present
    document.querySelectorAll('[data-consent-toggle]').forEach(input => {
      const cat = input.getAttribute('data-consent-toggle');
      if (input.type === 'checkbox') input.checked = !!consent[cat];
    });

    // Add data attribute to document for styling
    document.documentElement.setAttribute('data-cookie-analytics', consent.analytics ? 'granted' : 'denied');
    document.documentElement.setAttribute('data-cookie-ads', consent.ads ? 'granted' : 'denied');
  }

  // Initialization
  function init() {
    // If analytics not consented and a gtag script already exists, try to deny collection
    disableGtagIfNeeded();

    bindControls();
    // Observe DOM for late-added consent controls (e.g., settings modal)
    try {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          m.addedNodes && m.addedNodes.forEach(node => {
            if (!(node instanceof HTMLElement)) return;
            if (node.matches && node.matches('[data-consent-toggle]')) {
              bindToggle(node);
            }
            node.querySelectorAll && node.querySelectorAll('[data-consent-toggle]').forEach(el => bindToggle(el));

            // Also wire action buttons added later
            const actionBinder = (el) => {
              if (!el || el.__cookieActionBound) return;
              el.__cookieActionBound = true;
              const act = el.getAttribute('data-consent-action');
              if (act === 'accept-all') {
                el.addEventListener('click', (e) => { e.preventDefault(); acceptAll(); loadOptionalScripts(); updateUI(); });
              } else if (act === 'reject-all') {
                el.addEventListener('click', (e) => { e.preventDefault(); rejectAll(); updateUI(); });
              } else if (act === 'open-settings') {
                el.addEventListener('click', (e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('cookieOpenSettings')); });
              }
            };
            if (node.matches && node.matches('[data-consent-action]')) actionBinder(node);
            node.querySelectorAll && node.querySelectorAll('[data-consent-action]').forEach(actionBinder);
          });
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {
      console.warn('CookieConsent: MutationObserver not available', e);
    }
    updateUI();
    // Load optional scripts only if consent is already granted
    loadOptionalScripts();

    // Expose small helper for other modules
    window.CookieConsent = window.CookieConsent || {
      isConsented,
      setConsent,
      acceptAll,
      rejectAll,
      reset,
      loadOptionalScripts,
      getConsent: () => ({ ...consent })
    };
  }

  // Auto init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
