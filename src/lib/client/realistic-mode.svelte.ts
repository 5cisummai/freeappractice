const STORAGE_KEY = 'fap_realistic_mode';

class RealisticModeController {
	enabled = $state(false);

	constructor() {
		if (typeof window === 'undefined') return;
		this.load();
	}

	private load(): void {
		if (typeof window === 'undefined') return;
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === 'true') this.enabled = true;
		else if (saved === 'false') this.enabled = false;
	}

	setEnabled(value: boolean): void {
		this.enabled = value;
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, String(value));
		} catch {
			// Keep in-memory preference if persistence fails.
		}
	}
}

export const realisticMode = new RealisticModeController();
