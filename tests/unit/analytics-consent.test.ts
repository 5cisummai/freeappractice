import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ANALYTICS_CONSENT_KEY,
	clearAnalyticsConsentStorage,
	persistAnalyticsConsent,
	readAnalyticsConsent,
	syncAnalyticsConsentCookie
} from '#lib/client/analytics-consent.js';

function stubBrowser() {
	let cookie = '';
	const storage = {
		getItem: vi.fn(() => 'granted'),
		setItem: vi.fn(),
		removeItem: vi.fn()
	};
	vi.stubGlobal('window', { location: { protocol: 'https:' } });
	vi.stubGlobal('localStorage', storage);
	vi.stubGlobal('document', {
		get cookie() {
			return cookie;
		},
		set cookie(value: string) {
			cookie = value.split(';')[0] ?? '';
		}
	});
	return storage;
}

function storageBlocked(): never {
	throw new DOMException('The operation is insecure.', 'SecurityError');
}

afterEach(() => vi.unstubAllGlobals());

describe('analytics consent with restricted storage', () => {
	it('loads without consent when storage reads are blocked', () => {
		const storage = stubBrowser();
		storage.getItem.mockImplementation(storageBlocked);
		expect(readAnalyticsConsent()).toBeNull();
	});

	it('honors rejection when the old grant is readable but writes are blocked', () => {
		const storage = stubBrowser();
		storage.setItem.mockImplementation(storageBlocked);
		persistAnalyticsConsent('denied');
		syncAnalyticsConsentCookie();
		expect(readAnalyticsConsent()).toBe('denied');
		expect(document.cookie).toBe(`${ANALYTICS_CONSENT_KEY}=denied`);
	});

	it('does not migrate an old grant after deletion is blocked', () => {
		const storage = stubBrowser();
		storage.removeItem.mockImplementation(storageBlocked);
		clearAnalyticsConsentStorage();
		syncAnalyticsConsentCookie();
		expect(readAnalyticsConsent()).toBeNull();
	});

	it('backfills the cookie for an existing local-storage grant', () => {
		stubBrowser();
		syncAnalyticsConsentCookie();
		expect(document.cookie).toBe(`${ANALYTICS_CONSENT_KEY}=granted`);
	});
});
