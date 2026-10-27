const CHUNK_RELOAD_AT_KEY = 'chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 10_000;

function dynamicImportFailureMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return typeof error === 'string' ? error : '';
}

export function isDynamicImportFailure(error: unknown): boolean {
	const message = dynamicImportFailureMessage(error);

	return (
		message.includes('Failed to fetch dynamically imported module') ||
		message.includes('Importing a module script failed') ||
		message.includes('error loading dynamically imported module')
	);
}

/** Reload once so a stale tab or a dropped chunk request can pick up the current build. */
export function reloadOnceForChunkFailure(): boolean {
	if (typeof window === 'undefined') return false;

	try {
		const previous = Number(sessionStorage.getItem(CHUNK_RELOAD_AT_KEY) || 0);
		if (Number.isFinite(previous) && Date.now() - previous < CHUNK_RELOAD_WINDOW_MS) {
			return false;
		}
		sessionStorage.setItem(CHUNK_RELOAD_AT_KEY, String(Date.now()));
	} catch {
		return false;
	}

	window.location.reload();
	return true;
}
