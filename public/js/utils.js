/**
 * Utility Functions
 */

const Utils = {
    /**
     * Safely escape HTML to prevent XSS
     */
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Debounce function for performance optimization
     */
    debounce(fn, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    /**
     * Deep clone object safely
     */
    deepClone(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch {
            return obj;
        }
    }
};
