/**
 * Settings Modal Component Loader
 * Loads the settings modal component and initializes theme management
 * Usage: The component auto-loads on DOMContentLoaded if body exists
 */

async function loadSettingsModal() {
    try {
        const response = await fetch('/components/settings-modal.html');
        if (!response.ok) {
            throw new Error(`Failed to load settings modal component: ${response.status}`);
        }

        const html = await response.text();
        
        // Insert before closing body tag
        document.body.insertAdjacentHTML('beforeend', html);

        // Initialize the modal functionality
        initializeSettingsModal();
    } catch (error) {
        console.error('Error loading settings modal component:', error);
    }
}

function initializeSettingsModal() {
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const themeSelect = document.getElementById('themeSelect');
    const cookiesSection = document.getElementById('cookiesSection');
    const COOKIE_STORAGE_KEY = 'cookieConsent:v1';

    if (!settingsModal || !closeSettings || !themeSelect) {
        console.warn('Settings modal elements not found');
        return;
    }

    // Close modal handler
    closeSettings.addEventListener('click', () => {
        settingsModal.classList.remove('show');
    });

    // Close on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('show');
        }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal.classList.contains('show')) {
            settingsModal.classList.remove('show');
        }
    });

    // Theme select handler
    function applyThemeChoice(theme) {
        localStorage.setItem('theme', theme);
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    // Set initial theme value
    const savedTheme = localStorage.getItem('theme') || 'system';
    themeSelect.value = savedTheme;

    // Listen for theme changes
    themeSelect.addEventListener('change', (e) => {
        applyThemeChoice(e.target.value);
    });

    // Provider select (AI provider preference)
    /*
    const providerSelect = document.getElementById('providerSelect');
    if (providerSelect) {
        const savedProvider = localStorage.getItem('provider') || 'local';
        providerSelect.value = savedProvider;
        providerSelect.addEventListener('change', (e) => {
            localStorage.setItem('provider', e.target.value);
            // Let other modules react if needed
            window.dispatchEvent(new CustomEvent('providerChange', { detail: e.target.value }));
        });
    }
    */
   
    // Make openSettings function globally available
    window.openSettings = function() {
        settingsModal.classList.add('show');
    };

    function ensureToastHost() {
        let toast = document.getElementById('cookie-settings-toast');
        if (toast) return toast;

        const style = document.createElement('style');
        style.id = 'cookie-settings-toast-style';
        style.textContent = `
            #cookie-settings-toast {
                position: fixed;
                right: 16px;
                bottom: 16px;
                z-index: 99999;
                background: var(--bg-primary, #fff);
                color: var(--text-primary, #111);
                border: 1px solid var(--border-color, #e6e6e6);
                box-shadow: 0 6px 20px rgba(0,0,0,0.12);
                padding: 10px 14px;
                border-radius: 10px;
                font-size: 13px;
                opacity: 0;
                transform: translateY(6px);
                transition: opacity 180ms ease, transform 180ms ease;
                pointer-events: none;
                max-width: min(320px, 90vw);
            }
            #cookie-settings-toast.show {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);

        toast = document.createElement('div');
        toast.id = 'cookie-settings-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
        return toast;
    }

    let toastTimer = null;
    function showCookieToast(message) {
        const toast = ensureToastHost();
        toast.textContent = message;
        toast.classList.add('show');
        if (toastTimer) window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.classList.remove('show');
        }, 2400);
    }

    function updateCookiesSectionVisibility() {
        if (!cookiesSection) return;
        const hasConsent = !!localStorage.getItem(COOKIE_STORAGE_KEY);
        cookiesSection.style.display = hasConsent ? 'none' : '';
        cookiesSection.setAttribute('aria-hidden', hasConsent ? 'true' : 'false');
    }

    // Open when cookie preferences requested
    window.addEventListener('cookieOpenSettings', () => {
        settingsModal.classList.add('show');
        // If cookies section exists, bring it into view for convenience
        if (cookiesSection && typeof cookiesSection.scrollIntoView === 'function') {
            cookiesSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    updateCookiesSectionVisibility();

    window.addEventListener('cookieConsentChange', (e) => {
        updateCookiesSectionVisibility();
        showCookieToast('Cookie preferences updated');
    });
}

// Auto-load component on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSettingsModal();
});

// Export for manual use
window.loadSettingsModal = loadSettingsModal;
