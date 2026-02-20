// Authorization utility functions

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';

// Get stored token
function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Store token
function setAuthToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    // Broadcast login event so other components (cookie banner, UI) can react immediately
    try {
        window.dispatchEvent(new Event('auth:login'));
    } catch (e) {
        // ignore in older browsers
    }
}

// Remove token
function clearAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    // Broadcast logout event
    try {
        window.dispatchEvent(new Event('auth:logout'));
    } catch (e) {
        // ignore
    }
}

// Get stored user data
function getUserData() {
    const data = localStorage.getItem(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
}

// Store user data
function setUserData(user) {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
}

// Check if user is logged in
function isLoggedIn() {
    return !!getAuthToken();
}

// Make authenticated API request
async function authFetch(url, options = {}) {
    const token = getAuthToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Retry network-level errors a few times (transient connection resets)
    const MAX_RETRIES = 3;
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // If unauthorized, clear token and redirect to login
            if (response.status === 401) {
                clearAuthToken();
                if (window.location.pathname !== '/auth/login.html') {
                    window.location.href = '/auth/login.html';
                }
            }

            return response;
        } catch (err) {
            // Network error (e.g., ERR_CONNECTION_RESET) will end up here as a TypeError
            attempt++;
            console.warn(`authFetch attempt ${attempt} failed for ${url}:`, err.message || err);
            if (attempt >= MAX_RETRIES) {
                throw err; // rethrow after retries exhausted
            }
            // small backoff before retrying
            await new Promise(r => setTimeout(r, 300 * attempt));
        }
    }
}

// Login function
async function login(email, password) {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'Login failed');
    }
    
    setAuthToken(data.token);
    setUserData(data.user);
    
    return data;
}

// Register function
async function register(name, email, password) {
    const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
    }
    
    setAuthToken(data.token);
    setUserData(data.user);
    
    return data;
}

// Logout function
async function logout() {
    const token = getAuthToken();
    if (!confirm('Are you sure you want to log out?')) {
        return;
    }
    if (token) {
        try {
            await authFetch('/api/auth/logout', { method: 'POST' });
        } catch (err) {
            console.error('Logout error:', err);
        }
    }
    
    clearAuthToken();
    window.location.href = '/';
}

// Get current user from API
async function getCurrentUser() {
    if (!isLoggedIn()) {
        return null;
    }
    
    try {
        const response = await authFetch('/api/auth/current-user');
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        setUserData(data.user);
        return data.user;
    } catch (err) {
        console.error('Get current user error:', err);
        return null;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getAuthToken,
        setAuthToken,
        clearAuthToken,
        getUserData,
        setUserData,
        isLoggedIn,
        authFetch,
        login,
        register,
        logout,
        getCurrentUser
    };
}
