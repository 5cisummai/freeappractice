/** Cache a dynamically imported component while allowing a failed download to be retried. */
export function createLazyComponentLoader<T>(
	importer: () => Promise<{ default: T }>
): () => Promise<T> {
	let pending: Promise<T> | undefined;
	return () =>
		(pending ??= importer()
			.then((module) => module.default)
			.catch((error) => {
				pending = undefined;
				throw error;
			}));
}
