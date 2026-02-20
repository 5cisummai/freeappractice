/**
 * Storage Manager - Handle localStorage operations
 */

const StorageManager = {
    /**
     * Get progress data from localStorage
     */
    getProgress() {
        try {
            return JSON.parse(localStorage.getItem('apProgress') || '{}');
        } catch {
            return {};
        }
    },

    /**
     * Save progress data to localStorage
     */
    setProgress(data) {
        try {
            localStorage.setItem('apProgress', JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save progress:', error);
            return false;
        }
    },

    /**
     * Get theme preference
     */
    getTheme() {
        return localStorage.getItem('theme') || 'system';
    },

    /**
     * Set theme preference
     */
    setTheme(theme) {
        localStorage.setItem('theme', theme);
    },

    /**
     * Get progress panel visibility preference
     */
    isProgressHidden() {
        return localStorage.getItem('progressHidden') === 'true';
    },

    /**
     * Set progress panel visibility preference
     */
    setProgressHidden(hidden) {
        localStorage.setItem('progressHidden', hidden ? 'true' : 'false');
    }
};
