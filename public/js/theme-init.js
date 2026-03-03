(function() {
    // immediately apply stored or system theme to avoid flash
    function apply(theme) {
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    const theme = localStorage.getItem('theme') || 'system';
    apply(theme);

    // keep in sync with OS setting when user chooses system preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const current = localStorage.getItem('theme') || 'system';
        if (current === 'system') {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });
})();
