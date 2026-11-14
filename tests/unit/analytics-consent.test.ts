import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ANALYTICS_CONSENT_KEY,
	clearAnalyticsConsentStorage,
	hasAnalyticsConsent,
	persistAnalyticsConsent,
	readAnalyticsConsent,
	syncAnalyticsConsentCookie
} from '#lib/client/analytics-consent.js';

type StorageLike = {
	getItem: (key: string) => string | null;
	setItem: (key: string, value: string) => void;
	removeItem: (key: string) => void;
};

function createStorage(): StorageLike {
	const values = new Map<string, string>();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => {
			values.set(key, value);
		},
		removeItem: (key) => {
			values.delete(key);
		}
	};
}

function createBlockedStorage(): StorageLike {
	const error = () => {
		throw new DOMException('The operation is insecure.', 'SecurityError');
	};
	return {
		getItem: error,
		setItem: error,
		removeItem: error
	};
}

function stubBrowser({ storage, cookie = '' }: { storage: StorageLike; cookie?: string }) {
	let cookieValue = cookie;
	vi.stubGlobal('window', {
		localStorage: storage,
		location: { protocol: 'https:' }
	});
	vi.stubGlobal('localStorage', storage);
	vi.stubGlobal('document', {
		get cookie() {
			return cookieValue;
		},
		set cookie(value: string) {
			cookieValue = value;
		}
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('readAnalyticsConsent', () => {
	it('returns null without a window', () => {
		expect(readAnalyticsConsent()).toBeNull();
	});

	it.each(['granted', 'denied'] as const)('reads %s consent from localStorage', (consent) => {
		const storage = createStorage();
		storage.setItem(ANALYTICS_CONSENT_KEY, consent);
		stubBrowser({ storage });

		expect(readAnalyticsConsent()).toBe(consent);
	});

	it('returns null when localStorage throws SecurityError and no cookie is set', () => {
		stubBrowser({ storage: createBlockedStorage() });

		expect(readAnalyticsConsent()).toBeNull();
		expect(hasAnalyticsConsent()).toBe(false);
	});

	it('falls back to the consent cookie when localStorage is blocked', () => {
		stubBrowser({
			storage: createBlockedStorage(),
			cookie: `${ANALYTICS_CONSENT_KEY}=granted`
		});

		expect(readAnalyticsConsent()).toBe('granted');
		expect(hasAnalyticsConsent()).toBe(true);
	});
});

describe('persistAnalyticsConsent', () => {
	it('writes localStorage and a cookie', () => {
		const storage = createStorage();
		stubBrowser({ storage });

		persistAnalyticsConsent('granted');

		expect(storage.getItem(ANALYTICS_CONSENT_KEY)).toBe('granted');
		expect(document.cookie).toContain(`${ANALYTICS_CONSENT_KEY}=granted`);
	});

	it('still writes the consent cookie when localStorage is blocked', () => {
		stubBrowser({ storage: createBlockedStorage() });

		expect(() => persistAnalyticsConsent('denied')).not.toThrow();
		expect(document.cookie).toContain(`${ANALYTICS_CONSENT_KEY}=denied`);
		expect(readAnalyticsConsent()).toBe('denied');
	});
});

describe('clearAnalyticsConsentStorage', () => {
	it('does not throw when storage is blocked', () => {
		stubBrowser({
			storage: createBlockedStorage(),
			cookie: `${ANALYTICS_CONSENT_KEY}=granted`
		});

		expect(() => clearAnalyticsConsentStorage()).not.toThrow();
		expect(document.cookie).toContain(`${ANALYTICS_CONSENT_KEY}=`);
		expect(readAnalyticsConsent()).toBeNull();
	});
});

describe('syncAnalyticsConsentCookie', () => {
	it('backfills the cookie from localStorage', () => {
		const storage = createStorage();
		storage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
		stubBrowser({ storage });

		syncAnalyticsConsentCookie();

		expect(document.cookie).toContain(`${ANALYTICS_CONSENT_KEY}=granted`);
	});
});
