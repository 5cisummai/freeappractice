import { describe, expect, it } from 'vitest';
import {
	getPostHogOperationDisposition,
	type PostHogOperationKind
} from '$lib/client/posthog-consent-policy';

describe('getPostHogOperationDisposition', () => {
	const detailedOperations: PostHogOperationKind[] = ['capture', 'identify'];
	const pageTrafficOperations: PostHogOperationKind[] = ['pageview', 'pageleave'];

	it.each(detailedOperations)('queues %s while consent is undecided', (kind) => {
		expect(getPostHogOperationDisposition(null, kind)).toBe('queue');
	});

	it('drops exceptions while consent is undecided', () => {
		expect(getPostHogOperationDisposition(null, 'exception')).toBe('drop');
	});

	it.each(pageTrafficOperations)('sends cookieless %s while consent is undecided', (kind) => {
		expect(getPostHogOperationDisposition(null, kind)).toBe('send');
	});

	it('drops detailed operations after consent is denied', () => {
		for (const kind of [...detailedOperations, 'exception'] as const) {
			expect(getPostHogOperationDisposition('denied', kind)).toBe('drop');
		}
	});

	it.each(pageTrafficOperations)('keeps rejected %s cookieless', (kind) => {
		expect(getPostHogOperationDisposition('denied', kind)).toBe('send');
	});

	it.each(['capture', 'identify', 'pageview', 'pageleave', 'exception'] as const)(
		'sends %s after consent is granted',
		(kind) => {
			expect(getPostHogOperationDisposition('granted', kind)).toBe('send');
		}
	);
});
