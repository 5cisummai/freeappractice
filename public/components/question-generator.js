/**
 * Question Generator Component Loader
 * Loads the question generator component into any page that needs it
 * Usage: <div id="question-generator-mount"></div>
 * Then call: loadQuestionGenerator('#question-generator-mount')
 */

async function loadQuestionGenerator(mountSelector = '#question-generator-mount') {
    try {
        const response = await fetch('/components/question-generator.html');
        if (!response.ok) {
            throw new Error(`Failed to load question generator component: ${response.status}`);
        }

        const html = await response.text();
        const mountElement = document.querySelector(mountSelector);

        if (!mountElement) {
            console.warn(`Mount element not found: ${mountSelector}`);
            return;
        }

        // Insert the component HTML
        mountElement.innerHTML = html;

        // Ask app.js to wire up listeners now that the component exists
        if (typeof window.initQuestionSection === 'function') {
            try { window.initQuestionSection(); } catch (e) { console.warn('initQuestionSection failed', e); }
        }
    } catch (error) {
        console.error('Error loading question generator component:', error);
    }
}

// Auto-load component if element exists on page load
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('#question-generator-mount')) {
        loadQuestionGenerator('#question-generator-mount');
    }
});

// Export for manual use
window.loadQuestionGenerator = loadQuestionGenerator;
