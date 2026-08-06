import { describe, expect, it } from 'vitest';
import { shouldApplySubscriptionEvent } from '$lib/super/billing.server';

describe('Stripe subscription event ordering', () => {
	it('ignores a duplicate event id', () => {
		expect(
			shouldApplySubscriptionEvent(
				{
					lastStripeEventId: 'evt_123',
					lastStripeEventCreated: new Date('2026-08-06T18:00:00.000Z')
				},
				{
					eventId: 'evt_123',
					eventCreated: new Date('2026-08-06T18:00:00.000Z')
				}
			)
		).toBe(false);
	});

	it('ignores an older event after a newer event', () => {
		expect(
			shouldApplySubscriptionEvent(
				{ lastStripeEventCreated: new Date('2026-08-06T18:01:00.000Z') },
				{ eventId: 'evt_old', eventCreated: new Date('2026-08-06T18:00:00.000Z') }
			)
		).toBe(false);
	});

	it('accepts a newer event', () => {
		expect(
			shouldApplySubscriptionEvent(
				{ lastStripeEventCreated: new Date('2026-08-06T18:00:00.000Z') },
				{ eventId: 'evt_new', eventCreated: new Date('2026-08-06T18:01:00.000Z') }
			)
		).toBe(true);
	});
});
