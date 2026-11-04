/** Same-origin `/app` path only; anything else falls back to `/app`. */
export function safeAppPath(path: string | null | undefined): string {
	if (!path) return '/app';
	if (!path.startsWith('/app')) return '/app';
	if (path.startsWith('//') || path.includes('\\') || path.includes('\n')) return '/app';
	if (path.includes('://')) return '/app';
	return path;
}
