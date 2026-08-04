import { describe, expect, it } from 'vitest';
import {
	getPostHogOperationDisposition,
	type PostHogOperationKind
} from '$lib/client/posthog-consent-policy';

describe('getPostHogOperationDisposition', () => {
	const detailedOperations: PostHogOperationKind[] = ['capture', 'identify'];

	it.each(detailedOperations)('queues %s while consent is undecided', (kind) => {
		expect(getPostHogOperationDisposition(null, kind)).toBe('queue');
	});

	it('drops pageviews and exceptions while consent is undecided', () => {
		expect(getPostHogOperationDisposition(null, 'pageview')).toBe('drop');
		expect(getPostHogOperationDisposition(null, 'exception')).toBe('drop');
	});

	it('drops detailed operations after consent is denied', () => {
		for (const kind of [...detailedOperations, 'exception'] as const) {
			expect(getPostHogOperationDisposition('denied', kind)).toBe('drop');
		}
	});

	it('keeps rejected pageviews cookieless', () => {
		expect(getPostHogOperationDisposition('denied', 'pageview')).toBe('send');
	});

	it.each(['capture', 'identify', 'pageview', 'exception'] as const)(
		'sends %s after consent is granted',
		(kind) => {
			expect(getPostHogOperationDisposition('granted', kind)).toBe('send');
		}
	);
});
