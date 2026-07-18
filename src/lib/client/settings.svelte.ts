import { setMode } from 'mode-watcher';
import { invalidateAll } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { authClient } from '$lib/auth/client.js';
import { authCallbackUrl } from '$lib/auth/urls.js';
import { getSiteUrl } from '$lib/site-url.js';

type SettingsData = {
	theme: 'light' | 'dark' | 'system';
};

type AccountUser = {
	name: string;
	email: string;
};

class SettingsController {
	settings = $state<SettingsData>({
		theme: 'system'
	});
	accountPending = $state(false);
	deletePending = $state(false);

	constructor() {
		if (typeof window === 'undefined') return;

		this.load();
		setMode(this.settings.theme);
		document.documentElement.style.fontSize = '';
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
				this.settings = { theme };
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
	}

	setTheme(theme: 'light' | 'dark' | 'system') {
		this.settings.theme = theme;
		setMode(theme);
		this.save();
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
				toast.success('Check your current inbox to approve the email change.');
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

	async deleteAccount(password?: string): Promise<'deleted' | 'pending' | false> {
		if (this.deletePending) return false;
		this.deletePending = true;
		try {
			const { data, error } = await authClient.deleteUser({
				...(password ? { password } : {}),
				callbackURL: `${getSiteUrl()}/`
			});
			if (error) throw new Error(error.message ?? 'Failed to delete account');

			if (data?.message === 'Verification email sent') {
				toast.success('Check your email to confirm account deletion.');
				return 'pending';
			}

			toast.success('Account deleted successfully');
			window.location.href = '/';
			return 'deleted';
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete account');
			return false;
		} finally {
			this.deletePending = false;
		}
	}
}

export const settingsController = new SettingsController();
