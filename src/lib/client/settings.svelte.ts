import { invalidateAppLayout, invalidateAppSubtree } from '$lib/client/invalidate-data.js';
import { toast } from 'svelte-sonner';
import { authClient } from '$lib/auth/client.js';
import { authCallbackUrl } from '$lib/auth/urls.js';
import { getSiteUrl } from '$lib/site-url.js';
import { resetPostHogUser } from '$lib/client/posthog-analytics';
import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
import { MAX_NAME_LENGTH } from '$lib/auth/name-policy';

type AccountUser = {
	name: string;
	email: string;
};

class AccountActions {
	accountPending = $state(false);
	deletePending = $state(false);
	clearPracticePending = $state(false);

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
			if (Array.from(name).length > MAX_NAME_LENGTH) {
				toast.error(`Name must be ${MAX_NAME_LENGTH} characters or fewer`);
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

			await invalidateAppLayout();
			toast.success('Account updated successfully');
			return true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to update account');
			return false;
		} finally {
			this.accountPending = false;
		}
	}

	async clearPracticeData(): Promise<boolean> {
		if (this.clearPracticePending) return false;
		this.clearPracticePending = true;
		try {
			const response = await apiFetch('/api/me/practice-data', { method: 'DELETE' });
			const payload = await readJsonOrNull<{ error?: string; message?: string }>(response);
			if (!response.ok) {
				throw new Error(getResponseMessage(payload, 'Failed to clear practice data'));
			}

			await invalidateAppSubtree();
			toast.success('Practice data cleared');
			return true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to clear practice data');
			return false;
		} finally {
			this.clearPracticePending = false;
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
			resetPostHogUser();
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

export const accountActions = new AccountActions();
