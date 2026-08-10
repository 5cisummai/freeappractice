import { setMode } from 'mode-watcher';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'fap_settings';

class ThemeController {
	theme = $state<Theme>('system');

	constructor() {
		if (typeof window === 'undefined') return;
		this.theme = this.load();
		setMode(this.theme);
	}

	private load(): Theme {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (!saved) return 'system';

		try {
			const value = (JSON.parse(saved) as { theme?: unknown }).theme;
			return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
		} catch {
			localStorage.removeItem(STORAGE_KEY);
			return 'system';
		}
	}

	set(theme: Theme): void {
		this.theme = theme;
		setMode(theme);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme }));
		} catch {
			// The selected mode still applies when browser storage is unavailable.
		}
	}
}

export const themeController = new ThemeController();
