import { describe, expect, it, vi } from 'vitest';
import { createLazyComponentLoader } from '$lib/client/lazy-component';

describe('createLazyComponentLoader', () => {
	it('shares an in-flight import and caches the loaded component', async () => {
		const component = { name: 'ExampleComponent' };
		const importer = vi.fn().mockResolvedValue({ default: component });
		const load = createLazyComponentLoader(importer);

		const first = load();
		const second = load();

		expect(first).toBe(second);
		await expect(first).resolves.toBe(component);
		await expect(load()).resolves.toBe(component);
		expect(importer).toHaveBeenCalledTimes(1);
	});

	it('clears a failed import so a retry can succeed', async () => {
		const component = { name: 'ExampleComponent' };
		const importer = vi
			.fn()
			.mockRejectedValueOnce(new Error('chunk failed'))
			.mockResolvedValueOnce({ default: component });
		const load = createLazyComponentLoader(importer);

		await expect(load()).rejects.toThrow('chunk failed');
		await expect(load()).resolves.toBe(component);
		expect(importer).toHaveBeenCalledTimes(2);
	});
});
