/**
 * Lightweight i18n module for Free AP Practice.
 *
 * Browser-native translation (Google Translate, Firefox Translations, etc.) is
 * already enabled by the `lang="en"` attribute on the root `<html>` element in
 * `src/app.html`, so users who prefer browser-level translation can rely on
 * that without any additional setup.
 *
 * This module provides a programmatic alternative that:
 *  - stores the active locale in localStorage across sessions,
 *  - updates the document `lang` attribute so assistive technology and browser
 *    translation heuristics stay in sync, and
 *  - exposes a reactive `t()` helper for translating individual keys.
 *
 * Adding a new language
 * ---------------------
 * 1. Copy `src/lib/i18n/locales/en.json` to e.g. `locales/fr.json`.
 * 2. Translate every value in the new file.
 * 3. Import the file below and add it to the `translations` map.
 * 4. Add the new locale code to the `Locale` union type and
 *    `SUPPORTED_LOCALES` array.
 */

import { browser } from '$app/environment';
import { derived, writable } from 'svelte/store';

import en from './locales/en.json';
import es from './locales/es.json';

export type Locale = 'en' | 'es';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es'];

export const LOCALE_LABELS: Record<Locale, string> = {
	en: 'English',
	es: 'Español'
};

const translations: Record<Locale, Record<string, unknown>> = { en, es };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidLocale(value: unknown): value is Locale {
	return SUPPORTED_LOCALES.includes(value as Locale);
}

function getInitialLocale(): Locale {
	if (browser) {
		const stored = localStorage.getItem('locale');
		if (isValidLocale(stored)) return stored;

		// Use the browser's preferred language if we support it.
		const browserLang = navigator.language.split('-')[0];
		if (isValidLocale(browserLang)) return browserLang;
	}
	return 'en';
}

/**
 * Walks a nested object using a dot-separated path and returns the string
 * value, or `undefined` when the path does not exist.
 */
function lookup(obj: Record<string, unknown>, path: string): string | undefined {
	const keys = path.split('.');
	let current: unknown = obj;
	for (const key of keys) {
		if (typeof current !== 'object' || current === null) return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return typeof current === 'string' ? current : undefined;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const locale = writable<Locale>(getInitialLocale());

// Keep localStorage and the document lang attribute in sync.
locale.subscribe((value) => {
	if (browser) {
		localStorage.setItem('locale', value);
		document.documentElement.lang = value;
	}
});

// ---------------------------------------------------------------------------
// Translation helper
// ---------------------------------------------------------------------------

/**
 * A derived store whose value is a `t(key)` function.
 *
 * Usage in a Svelte component:
 * ```svelte
 * <script>
 *   import { t } from '$lib/i18n';
 * </script>
 *
 * <p>{$t('nav.blog')}</p>
 * ```
 */
export const t = derived(locale, ($locale) => {
	return (key: string): string => {
		// Try the active locale first, fall back to English.
		return lookup(translations[$locale], key) ?? lookup(translations['en'], key) ?? key;
	};
});
