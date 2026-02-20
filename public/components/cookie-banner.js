(function (window, document) {
  const STORAGE_KEY = 'cookieConsent:v1';
  const BANNER_ID = 'cookie-consent-banner';

  function hasStoredConsent() {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  // Removed page/login gating: show banner on any page until consent is set

  function createBanner() {
    if (document.getElementById(BANNER_ID)) return;

    const container = document.createElement('div');
    container.id = BANNER_ID;
    container.innerHTML = `
      <style>
        #${BANNER_ID} {
          position: fixed;
          left: 16px;
          right: 16px;
          bottom: 16px;
          z-index: 99999;
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e6e6e6);
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
          padding: 16px;
          border-radius: 10px;
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
        }
        #${BANNER_ID} .banner-left { display:flex; gap:12px; align-items: center; max-width: 70%; }
        #${BANNER_ID} .banner-left p { margin:0; color: var(--text-primary,#111); font-size: 14px; }
        #${BANNER_ID} .banner-actions { display:flex; gap:8px; align-items:center; }
        #${BANNER_ID} button { background: var(--accent-color,#077bff); color: #fff; border: none; padding: 8px 12px; border-radius:8px; cursor:pointer; font-weight:600; }
        #${BANNER_ID} .btn-secondary { background: transparent; border: 1px solid var(--border-color,#e6e6e6); color: var(--text-primary,#111); }
        #${BANNER_ID} .btn-link { background: transparent; border: none; color: var(--text-secondary,#666); text-decoration: underline; padding: 6px 8px; }
        @media (max-width:720px) { #${BANNER_ID} { flex-direction: column; align-items: stretch; } #${BANNER_ID} .banner-left { max-width:100%; } }
      </style>

      <div class="banner-left">
        <div aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" fill="#E6F0FF"/><path d="M7 12h10" stroke="#077bff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <p>
          We use optional cookies for analytics and ads to improve the site. You can accept or manage preferences. <a href="/privacy/">Learn more</a>
        </p>
      </div>

      <div class="banner-actions">
        <button class="btn-accept" data-consent-action="accept-all">Accept all</button>
        <button class="btn-reject btn-secondary" data-consent-action="reject-all">Reject all</button>
        <button class="btn-settings btn-link" data-consent-action="open-settings">Manage</button>
      </div>
    `;

    document.body.appendChild(container);

    // Button wiring: attempt to use CookieConsent API if available
    const acceptBtn = container.querySelector('.btn-accept');
    const rejectBtn = container.querySelector('.btn-reject');
    const settingsBtn = container.querySelector('.btn-settings');

    acceptBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.CookieConsent && typeof window.CookieConsent.acceptAll === 'function') {
        window.CookieConsent.acceptAll();
        window.CookieConsent.loadOptionalScripts();
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ necessary: true, analytics: true, ads: true }));
        window.dispatchEvent(new CustomEvent('cookieConsentChange', { detail: { consent: { necessary:true, analytics:true, ads:true } } }));
      }
      hideBanner();
    });

    rejectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.CookieConsent && typeof window.CookieConsent.rejectAll === 'function') {
        window.CookieConsent.rejectAll();
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ necessary: true, analytics: false, ads: false }));
        window.dispatchEvent(new CustomEvent('cookieConsentChange', { detail: { consent: { necessary:true, analytics:false, ads:false } } }));
      }
      hideBanner();
    });

    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Let other code open a settings modal
      window.dispatchEvent(new CustomEvent('cookieOpenSettings'));
    });
  }

  function hideBanner() {
    const el = document.getElementById(BANNER_ID);
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => { el.remove(); }, 260);
  }

  function init() {
    // Only show when no consent stored
    if (hasStoredConsent()) return;

    // Create banner immediately (before DOMContentLoaded) if body exists, else wait
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createBanner);
    } else {
      createBanner();
    }

    // If user sets consent via other UI, hide the banner
    window.addEventListener('cookieConsentChange', (e) => {
      if (localStorage.getItem(STORAGE_KEY)) hideBanner();
    });

    // If settings modal triggers an explicit save, cookies.js should set localStorage and emit cookieConsentChange
    window.addEventListener('cookieOptionalLoaded', () => { if (localStorage.getItem(STORAGE_KEY)) hideBanner(); });
  }

  init();
})(window, document);
