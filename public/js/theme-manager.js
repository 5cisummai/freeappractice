/**
 * Theme Manager - Handle theme switching
 * Dependencies: storage-manager.js
 */

const ThemeManager = {
    apply(theme) {
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    },

    initialize(themeSelect) {
        const savedTheme = StorageManager.getTheme();
        if (themeSelect) {
            themeSelect.value = savedTheme;
        }
        this.apply(savedTheme);

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (StorageManager.getTheme() === 'system') {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            }
        });
    }
};
