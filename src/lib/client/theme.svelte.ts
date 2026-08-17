import { modeStorageKey, setMode } from 'mode-watcher';

export type Theme = 'light' | 'dark' | 'system';

const LEGACY_STORAGE_KEY = 'fap_settings';

class ThemeController {
	constructor() {
		if (typeof window === 'undefined') return;

		// Migrate the old app-owned preference once. mode-watcher is the sole
		// persistence owner after this point.
		try {
			if (!localStorage.getItem(modeStorageKey.current)) {
				const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
				const value = saved ? (JSON.parse(saved) as { theme?: unknown }).theme : undefined;
				if (value === 'light' || value === 'dark' || value === 'system') {
					setMode(value);
				}
			}
			localStorage.removeItem(LEGACY_STORAGE_KEY);
		} catch {
			// mode-watcher still applies its default when browser storage is unavailable.
		}
	}

	set(theme: Theme): void {
		setMode(theme);
	}
}

export const themeController = new ThemeController();
