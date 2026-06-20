import { setMode } from 'mode-watcher';
import { invalidateAll } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { authClient } from '$lib/auth-client.js';
import { authCallbackUrl } from '$lib/auth-callback-url.js';

type SettingsData = {
	theme: 'light' | 'dark' | 'system';
	fontSize: number;
	highContrast: boolean;
	reduceMotion: boolean;
	dyslexicFont: boolean;
};

type AccountUser = {
	name: string;
	email: string;
};

class SettingsController {
	settings = $state<SettingsData>({
		theme: 'system',
		fontSize: 16,
		highContrast: false,
		reduceMotion: false,
		dyslexicFont: false
	});
	accountPending = $state(false);
	passwordPending = $state(false);
	deletePending = $state(false);

	constructor() {
		if (typeof window === 'undefined') return;

		this.load();
		setMode(this.settings.theme);
		this.applyAccessibility();
	}

	private load() {
		if (typeof window === 'undefined') return;
		const saved = localStorage.getItem('fap_settings');
		if (saved) {
			try {
				const data = JSON.parse(saved);
				this.settings = { ...this.settings, ...data };
			} catch {
				localStorage.removeItem('fap_settings');
			}
		}
	}

	private save() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem('fap_settings', JSON.stringify(this.settings));
		} catch {
			// Keep the current in-memory settings even if persistence fails.
		}
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

		root.style.fontSize = `${this.settings.fontSize}px`;
		document.body.classList.toggle('high-contrast', this.settings.highContrast);
		document.body.classList.toggle('reduce-motion', this.settings.reduceMotion);
		document.body.classList.toggle('dyslexic-font', this.settings.dyslexicFont);
	}

	async updateAccount(user: AccountUser, data: { name: string; email: string }) {
		if (this.accountPending) return false;
		this.accountPending = true;
		try {
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

			if (name !== user.name) {
				const { error } = await authClient.updateUser({ name });
				if (error) throw new Error(error.message ?? 'Failed to update name');
			}

			if (email !== user.email) {
				const { error } = await authClient.changeEmail({
					newEmail: email,
					callbackURL: authCallbackUrl('/app/settings')
				});
				if (error) throw new Error(error.message ?? 'Failed to update email');
				toast.success('Verification email sent to your new address.');
				window.location.href = `/email-sent?email=${encodeURIComponent(email)}`;
				return true;
			}

			await invalidateAll();
			toast.success('Account updated successfully');
			return true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to update account');
			return false;
		} finally {
			this.accountPending = false;
		}
	}

	async changePassword(data: {
		currentPassword: string;
		newPassword: string;
		confirmPassword: string;
	}): Promise<boolean> {
		if (this.passwordPending) return false;
		this.passwordPending = true;
		try {
			if (data.newPassword !== data.confirmPassword) {
				toast.error('New passwords do not match');
				return false;
			}
			if (data.newPassword.length < 8) {
				toast.error('Password must be at least 8 characters');
				return false;
			}

			const { error } = await authClient.changePassword({
				currentPassword: data.currentPassword,
				newPassword: data.newPassword,
				revokeOtherSessions: true
			});
			if (error) throw new Error(error.message ?? 'Failed to change password');

			toast.success('Password updated successfully');
			return true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to change password');
			return false;
		} finally {
			this.passwordPending = false;
		}
	}

	async deleteAccount(password?: string): Promise<boolean> {
		if (this.deletePending) return false;
		this.deletePending = true;
		try {
			const { error } = await authClient.deleteUser(password ? { password } : undefined);
			if (error) throw new Error(error.message ?? 'Failed to delete account');

			toast.success('Account deleted successfully');
			window.location.href = '/';
			return true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete account');
			return false;
		} finally {
			this.deletePending = false;
		}
	}
}

export const settingsController = new SettingsController();
