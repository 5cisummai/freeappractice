/** Normalize an object key (no leading slashes). */
export function normalizePublicAssetKey(key: string): string {
	return key.replace(/^\/+/, '');
}

/** Build a public CDN URL from a base origin and object key. */
export function buildPublicAssetUrl(baseUrl: string, key: string): string {
	const base = baseUrl.replace(/\/+$/, '');
	const path = normalizePublicAssetKey(key);
	return `${base}/${path}`;
}

/** CSP img-src origins for the configured public assets host (plus R2 defaults). */
export function publicAssetCspOrigins(baseUrl?: string): string[] {
	const origins = new Set<string>(['https://*.r2.dev']);
	const configured = baseUrl?.trim();
	if (!configured) return [...origins];

	try {
		origins.add(new URL(configured).origin);
	} catch {
		// Ignore invalid URLs at config time.
	}

	return [...origins];
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
	'.avif': 'image/avif',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp'
};

export function contentTypeForAssetPath(filePath: string): string {
	const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
	return CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
}
