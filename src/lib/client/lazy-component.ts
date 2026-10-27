import { isDynamicImportFailure, reloadOnceForChunkFailure } from '#lib/client/chunk-recovery.js';

const LAZY_IMPORT_RETRIES = 2;
const LAZY_IMPORT_RETRY_DELAY_MS = 250;

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/** Stay pending after a reload is triggered so the error UI does not flash. */
function hang<T>(): Promise<T> {
	return new Promise<T>(() => undefined);
}

/** Cache a dynamically imported component while allowing a failed download to be retried. */
export function createLazyComponentLoader<T>(
	importer: () => Promise<{ default: T }>
): () => Promise<T> {
	let pending: Promise<T> | undefined;
	return () => {
		pending ??= load();
		return pending;
	};

	async function load(): Promise<T> {
		let lastError: unknown;
		for (let attempt = 0; attempt <= LAZY_IMPORT_RETRIES; attempt++) {
			if (attempt > 0) await wait(LAZY_IMPORT_RETRY_DELAY_MS);
			try {
				const module = await importer();
				return module.default;
			} catch (error) {
				lastError = error;
			}
		}

		pending = undefined;

		if (isDynamicImportFailure(lastError) && reloadOnceForChunkFailure()) {
			return hang();
		}

		throw lastError;
	}
}
