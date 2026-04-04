import { setMode } from 'mode-watcher';
import { toast } from 'svelte-sonner';
import { apiFetch, auth } from '$lib/client/auth.svelte.js';

export type SettingsData = {
	theme: 'light' | 'dark' | 'system';
	fontSize: number;
	highContrast: boolean;
	reduceMotion: boolean;
	dyslexicFont: boolean;
};

class SettingsController {
	settings = $state<SettingsData>({
		theme: 'system',
		fontSize: 16,
		highContrast: false,
		reduceMotion: false,
		dyslexicFont: false
	});

	constructor() {
		this.load();
		setMode(this.settings.theme);
		// Initial sync with mode-watcher if available
		if (typeof window !== 'undefined') {
			this.applyAccessibility();
		}
	}

	private load() {
		if (typeof window === 'undefined') return;
		const saved = localStorage.getItem('fap_settings');
		if (saved) {
			try {
				const data = JSON.parse(saved);
				this.settings = { ...this.settings, ...data };
			} catch (e) {
				console.error('Failed to parse settings', e);
			}
		}
	}

	private save() {
		if (typeof window === 'undefined') return;
		localStorage.setItem('fap_settings', JSON.stringify(this.settings));
		this.applyAccessibility();
	}

	setTheme(theme: 'light' | 'dark' | 'system') {
		this.settings.theme = theme;
		setMode(theme);
		this.save();
	}

	setFontSize(size: number) {
		this.settings.fontSize = size;
		this.save();
	}

	toggleAccessibility(
		key: keyof Pick<SettingsData, 'highContrast' | 'reduceMotion' | 'dyslexicFont'>
	) {
		this.settings[key] = !this.settings[key];
		this.save();
	}

	private applyAccessibility() {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;

		// Font size
		root.style.fontSize = `${this.settings.fontSize}px`;

		// Body classes for styles
		document.body.classList.toggle('high-contrast', this.settings.highContrast);
		document.body.classList.toggle('reduce-motion', this.settings.reduceMotion);
		document.body.classList.toggle('dyslexic-font', this.settings.dyslexicFont);
	}

	async updateAccount(data: { name: string; email: string }) {
		try {
			if (!auth.user || !auth.token) {
				toast.error('You must be logged in to update your account');
				return false;
			}

			const name = data.name.trim();
			const email = data.email.trim().toLowerCase();

			if (!name) {
				toast.error('Name is required');
				return false;
			}
			if (!email) {
				toast.error('Email is required');
				return false;
			}

			const response = await apiFetch('/api/auth/update-account', {
				method: 'PATCH',
				body: JSON.stringify({ name, email })
			});

			const payload = (await response.json().catch(() => null)) as
				| {
						error?: string;
						message?: string;
						requiresVerification?: boolean;
						user?: { userId: string; name: string; email: string };
				  }
				| null;

			if (!response.ok) {
				throw new Error(payload?.error || 'Failed to update account');
			}

			if (payload?.user) {
				auth.setAuth(auth.token, payload.user);
			}

			if (payload?.requiresVerification) {
				toast.success(payload.message || 'Email updated. Please verify your new email.');
				window.location.href = '/email-sent';
				return true;
			}

			toast.success(payload?.message || 'Account updated successfully');
			return true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to update account');
			return false;
		}
	}

	async deleteAccount(): Promise<boolean> {
		try {
			const response = await apiFetch('/api/auth/delete-account', {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as { error?: string } | null;
				throw new Error(data?.error || 'Failed to delete account');
			}

			auth.clearAuth();
			toast.success('Account deleted successfully');
			window.location.href = '/';
			return true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete account');
			return false;
		}
	}
}

export const settingsController = new SettingsController();
