/**
 * Topbar Component
 * 
 * A reusable navigation bar component that adapts based on authentication state.
 * 
 * Usage:
 * <topbar-component 
 *   active-page="dashboard" 
 *   auth-state="authenticated"
 * ></topbar-component>
 * 
 * Attributes:
 * - active-page: Current page identifier (e.g., "dashboard", "progress")
 * - auth-state: Authentication state ("authenticated", "guest")
 */


class TopbarComponent extends HTMLElement {
  constructor() {
    super();
    this.navLinks = {
      authenticated: [
        { href: '/app/', label: 'Dashboard', id: 'dashboard' },
        { href: '/app/progress/', label: 'Progress', id: 'progress' }
      ],
      guest: [
        { href: '/', label: 'Home', id: 'home' },
        { href: '/privacy/', label: 'Privacy', id: 'privacy' },
        { href: '/terms/', label: 'Terms', id: 'terms' },
        { href: '/auth/login/', label: 'Sign In', id: 'signin', className: 'nav-signin' },
        

      ]
    };
  }

  async connectedCallback() {
    await this.loadTemplate();
    this.render();
    this.setupEventListeners();
  }

  async loadTemplate() {
    try {
      const response = await fetch('/components/topbar.html');
      const html = await response.text();
      this.innerHTML = html;
    } catch (error) {
      console.error('Failed to load topbar template:', error);
    }
  }

  render() {
    const activePage = this.getAttribute('active-page') || '';
    const authState = this.getAttribute('auth-state') || 'guest';
    
    // Render navigation links
    const nav = this.querySelector('.topbar-nav');
    if (nav) {
      const links = this.navLinks[authState] || this.navLinks.guest;
      nav.innerHTML = links.map(link => {
        const isActive = link.id === activePage;
        const className = [
          'nav-link',
          link.className || '',
          isActive ? 'active' : ''
        ].filter(Boolean).join(' ');
        
        return `<a href="${link.href}" class="${className}">${link.label}</a>`;
      }).join('');
    }

    // Show/hide user profile based on auth state
    const userProfile = this.querySelector('.user-profile');
    if (userProfile) {
      userProfile.style.display = authState === 'authenticated' ? 'flex' : 'none';
    }
  }

  setupEventListeners() {
    // Mobile menu toggle
    const mobileMenuBtn = this.querySelector('#topbarMobileMenuBtn');
    const topbarNav = this.querySelector('.topbar-nav');
    
    if (mobileMenuBtn && topbarNav) {
      mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        topbarNav.classList.toggle('active');
      });
      
      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.topbar-nav') && !e.target.closest('.mobile-menu-btn')) {
          topbarNav.classList.remove('active');
        }
      });
      
      // Close menu when clicking a link and prevent reload when already on that route
      const normalizePath = (pathname) => {
        const trimmed = pathname.replace(/\/+$/, '');
        return trimmed === '' ? '/' : trimmed;
      };

      topbarNav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (evt) => {
          const linkPath = normalizePath(link.pathname);
          const currentPath = normalizePath(window.location.pathname);
          if (linkPath === currentPath) {
            evt.preventDefault();
          }
          topbarNav.classList.remove('active');
        });
      });
    }

    // User profile dropdown
    const userProfileBtn = this.querySelector('#topbarUserProfileBtn');
    const userDropdown = this.querySelector('#topbarUserDropdown');
    
    if (userProfileBtn && userDropdown) {
      userProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
      });
      
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-profile')) {
          userDropdown.classList.remove('show');
        }
      });
    }

    // Settings button
    const openSettingsBtn = this.querySelector('#topbarOpenSettings');
    if (openSettingsBtn) {
      openSettingsBtn.addEventListener('click', () => {
        userDropdown?.classList.remove('show');
        // Trigger settings modal if available (settings-modal exposes window.openSettings)
        if (typeof window.openSettings === 'function') {
          window.openSettings();
        } else if (window.settingsModal && typeof window.settingsModal.open === 'function') {
          window.settingsModal.open();
        }
      });
    }

    // Logout button
    const logoutBtn = this.querySelector('#topbarLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Prefer global logout() from authorization.js which clears tokens and redirects
        if (typeof logout === 'function') {
          try {
            logout();
            return;
          } catch (err) {
            console.error('Logout failed via global logout():', err);
          }
        }

        // Fallback: call API and redirect
        (async () => {
          try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            if (response.ok) {
              window.location.href = '/auth/login/';
            } else {
              window.location.href = '/auth/login/';
            }
          } catch (error) {
            console.error('Logout error fallback:', error);
            window.location.href = '/auth/login/';
          }
        })();
      });
    }
  }

  /**
   * Set the user name displayed in the topbar
   * @param {string} name - User's display name
   */
  setUserName(name) {
    const userNameElement = this.querySelector('#topbarUserName');
    if (userNameElement) {
      userNameElement.textContent = name;
    }
  }

  /**
   * Update the active page highlight
   * @param {string} pageId - Page identifier
   */
  setActivePage(pageId) {
    this.setAttribute('active-page', pageId);
    const links = this.querySelectorAll('.nav-link');
    links.forEach(link => {
      link.classList.remove('active');
      if (link.textContent.toLowerCase() === pageId.toLowerCase()) {
        link.classList.add('active');
      }
    });
  }

  /**
   * Update authentication state
   * @param {string} state - "authenticated" or "guest"
   */
  setAuthState(state) {
    this.setAttribute('auth-state', state);
    this.render();
    this.setupEventListeners();
  }
}

// Register the custom element
customElements.define('topbar-component', TopbarComponent);
