const STORAGE_KEY = 'referral-card-dismissed';

class ReferralCardDismissController {
	dismissed = $state(false);

	constructor() {
		if (typeof window === 'undefined') return;
		this.load();
	}

	private load(): void {
		if (typeof window === 'undefined') return;
		this.dismissed = localStorage.getItem(STORAGE_KEY) === 'true';
	}

	dismiss(): void {
		this.dismissed = true;
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, 'true');
		} catch {
			// Keep in-memory dismissal if persistence fails.
		}
	}

	restore(): void {
		this.dismissed = false;
		if (typeof window === 'undefined') return;
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// Keep in-memory restore if persistence fails.
		}
	}
}

export const referralCardDismiss = new ReferralCardDismissController();
