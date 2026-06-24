import { setMode } from 'mode-watcher';
import { invalidateAll } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { authClient } from '$lib/auth/client.js';
import { authCallbackUrl } from '$lib/auth/urls.js';

type SettingsData = {
	theme: 'light' | 'dark' | 'system';
	fontSize: number;
};

type AccountUser = {
	name: string;
	email: string;
};

class SettingsController {
	settings = $state<SettingsData>({
		theme: 'system',
		fontSize: 16
	});
	accountPending = $state(false);
	deletePending = $state(false);

	constructor() {
		if (typeof window === 'undefined') return;

		this.load();
		setMode(this.settings.theme);
		this.applyFontSize();
	}

	private load() {
		if (typeof window === 'undefined') return;
		const saved = localStorage.getItem('fap_settings');
		if (saved) {
			try {
				const data = JSON.parse(saved) as Partial<SettingsData>;
				const theme =
					data.theme === 'light' || data.theme === 'dark' || data.theme === 'system'
						? data.theme
						: this.settings.theme;
				const fontSize =
					typeof data.fontSize === 'number' && data.fontSize >= 12 && data.fontSize <= 24
						? data.fontSize
						: this.settings.fontSize;
				this.settings = { theme, fontSize };
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
		this.applyFontSize();
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

	private applyFontSize() {
		if (typeof document === 'undefined') return;
		document.documentElement.style.fontSize = `${this.settings.fontSize}px`;
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
