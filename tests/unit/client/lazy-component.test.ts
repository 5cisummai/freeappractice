import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLazyComponentLoader } from '#lib/client/lazy-component.js';

const mocks = vi.hoisted(() => ({
	reloadOnceForChunkFailure: vi.fn()
}));

vi.mock('#lib/client/chunk-recovery.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/client/chunk-recovery.js')>();
	return {
		...actual,
		reloadOnceForChunkFailure: mocks.reloadOnceForChunkFailure
	};
});

const chunkError = new TypeError(
	'Failed to fetch dynamically imported module: /_app/immutable/chunks/quiz.js'
);
const otherError = new TypeError('Load failed');
const QuizPlayer = { name: 'QuizPlayer' };

function importerFrom(results: Array<{ default: unknown } | Error>) {
	const queue = [...results];
	return vi.fn(async () => {
		const next = queue.shift();
		if (next instanceof Error) throw next;
		if (!next) throw new Error('Unexpected extra import');
		return next;
	});
}

async function expectPending<T>(promise: Promise<T>): Promise<void> {
	let settled = false;
	void promise.then(
		() => {
			settled = true;
		},
		() => {
			settled = true;
		}
	);
	await vi.advanceTimersByTimeAsync(1_000);
	expect(settled).toBe(false);
	expect(mocks.reloadOnceForChunkFailure).toHaveBeenCalledOnce();
}

beforeEach(() => {
	vi.useFakeTimers();
	mocks.reloadOnceForChunkFailure.mockReset();
	mocks.reloadOnceForChunkFailure.mockReturnValue(false);
});
afterEach(() => {
	vi.useRealTimers();
});

describe('createLazyComponentLoader', () => {
	it('returns the module default on the first successful import', async () => {
		const importer = importerFrom([{ default: QuizPlayer }]);
		const load = createLazyComponentLoader(importer);

		await expect(load()).resolves.toBe(QuizPlayer);
		expect(importer).toHaveBeenCalledOnce();
		expect(mocks.reloadOnceForChunkFailure).not.toHaveBeenCalled();
	});

	it('retries a failed import after a short backoff and then succeeds', async () => {
		const importer = importerFrom([chunkError, { default: QuizPlayer }]);
		const load = createLazyComponentLoader(importer);
		const pending = load();

		await vi.advanceTimersByTimeAsync(249);
		expect(importer).toHaveBeenCalledOnce();

		await vi.advanceTimersByTimeAsync(1);
		await expect(pending).resolves.toBe(QuizPlayer);
		expect(importer).toHaveBeenCalledTimes(2);
		expect(mocks.reloadOnceForChunkFailure).not.toHaveBeenCalled();
	});

	it('retries twice before throwing a non-chunk failure', async () => {
		const importer = importerFrom([otherError, otherError, otherError]);
		const load = createLazyComponentLoader(importer);
		const pending = load();

		const rejection = expect(pending).rejects.toBe(otherError);
		await vi.runAllTimersAsync();
		await rejection;

		expect(importer).toHaveBeenCalledTimes(3);
		expect(mocks.reloadOnceForChunkFailure).not.toHaveBeenCalled();
	});

	it('reloads from the caught path after retries when the failure is a chunk load', async () => {
		mocks.reloadOnceForChunkFailure.mockReturnValue(true);
		const importer = importerFrom([chunkError, chunkError, chunkError]);
		const load = createLazyComponentLoader(importer);

		await expectPending(load());
		expect(importer).toHaveBeenCalledTimes(3);
	});

	it('throws after retries when chunk reload is blocked so Retry can run', async () => {
		const importer = importerFrom([chunkError, chunkError, chunkError]);
		const load = createLazyComponentLoader(importer);
		const pending = load();

		const rejection = expect(pending).rejects.toBe(chunkError);
		await vi.runAllTimersAsync();
		await rejection;

		expect(importer).toHaveBeenCalledTimes(3);
		expect(mocks.reloadOnceForChunkFailure).toHaveBeenCalledOnce();
	});

	it('clears a failed load so a later call can retry from scratch', async () => {
		const importer = importerFrom([otherError, otherError, otherError, { default: QuizPlayer }]);
		const load = createLazyComponentLoader(importer);
		const first = load();
		const firstRejection = expect(first).rejects.toBe(otherError);
		await vi.runAllTimersAsync();
		await firstRejection;

		const second = load();
		await vi.runAllTimersAsync();
		await expect(second).resolves.toBe(QuizPlayer);
		expect(importer).toHaveBeenCalledTimes(4);
	});
});
