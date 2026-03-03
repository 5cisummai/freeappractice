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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="28" height="28" role="img" aria-label="cookie"><path d="M311.2 81C289.1 77.9 266.6 81.9 246.8 92.4L172.8 131.9C153.1 142.4 137.2 158.9 127.4 179L90.7 254.6C80.9 274.7 77.7 297.5 81.6 319.5L96.1 402.3C100 424.4 110.7 444.6 126.8 460.2L187.1 518.6C203.2 534.2 223.7 544.2 245.8 547.3L328.8 559C350.9 562.1 373.4 558.1 393.2 547.6L467.2 508.1C486.9 497.6 502.8 481.1 512.6 460.9L549.3 385.4C559.1 365.3 562.3 342.5 558.4 320.5L543.8 237.7C539.9 215.6 529.2 195.4 513.1 179.8L452.9 121.5C436.8 105.9 416.3 95.9 394.2 92.8L311.2 81zM272 208C289.7 208 304 222.3 304 240C304 257.7 289.7 272 272 272C254.3 272 240 257.7 240 240C240 222.3 254.3 208 272 208zM208 400C208 382.3 222.3 368 240 368C257.7 368 272 382.3 272 400C272 417.7 257.7 432 240 432C222.3 432 208 417.7 208 400zM432 336C449.7 336 464 350.3 464 368C464 385.7 449.7 400 432 400C414.3 400 400 385.7 400 368C400 350.3 414.3 336 432 336z"/></svg>
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
