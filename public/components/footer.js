/**
 * Footer Component Loader
 * Loads and injects the footer component into the page
 */

(function() {
    // Load footer component
    fetch('/components/footer.html')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load footer');
            return response.text();
        })
        .then(html => {
            const footerContainer = document.getElementById('footer-container');
            if (footerContainer) {
                footerContainer.innerHTML = html;
            }
        })
        .catch(error => {
            console.error('Error loading footer component:', error);
        });
})();
