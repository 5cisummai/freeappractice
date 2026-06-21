import { env } from '$env/dynamic/public';
import { buildPublicAssetUrl, normalizePublicAssetKey } from '$lib/public-asset-url';

/** Whether `PUBLIC_R2_ASSETS_URL` is configured. */
export function isPublicAssetsConfigured(): boolean {
	return Boolean(env.PUBLIC_R2_ASSETS_URL?.trim());
}

/**
 * Resolve a public object key to its CDN URL.
 * Keys mirror the R2 object path, e.g. `pages/about/mission-planning.jpg`.
 */
export function publicAssetUrl(key: string): string {
	const base = env.PUBLIC_R2_ASSETS_URL?.trim();
	const path = normalizePublicAssetKey(key);

	if (!base) {
		throw new Error(
			'PUBLIC_R2_ASSETS_URL is not set. Add your public R2 bucket URL to .env to load CDN assets.'
		);
	}

	return buildPublicAssetUrl(base, path);
}
