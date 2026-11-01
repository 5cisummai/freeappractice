import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { RESEND_SIGNUP_SEGMENT_ID: 'segment-123', RESEND_API_KEY: 're_test' },
	create: vi.fn(),
	warn: vi.fn()
}));

vi.mock('$app/env/private', () => mocks.env);
vi.mock('resend', () => ({
	Resend: class {
		contacts = { create: mocks.create };
	}
}));
vi.mock('#lib/server/logger.js', () => ({ logger: { warn: mocks.warn } }));

import { syncResendContact } from '#lib/auth/contacts.server.js';

describe('signup contact sync', () => {
	const user = { email: 'student@example.com', name: 'Test Student' };

	beforeEach(() => {
		vi.resetAllMocks();
		mocks.env.RESEND_SIGNUP_SEGMENT_ID = 'segment-123';
		mocks.env.RESEND_API_KEY = 're_test';
		mocks.create.mockResolvedValue({ data: { id: 'contact-123' }, error: null });
	});

	it('adds the contact to the configured segment without setting subscription status', async () => {
		await syncResendContact(user);
		expect(mocks.create).toHaveBeenCalledWith({
			email: user.email,
			firstName: user.name,
			segments: [{ id: 'segment-123' }]
		});
	});

	it('skips sync when no destination is configured', async () => {
		mocks.env.RESEND_SIGNUP_SEGMENT_ID = '';
		await syncResendContact(user);
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it.each(['api', 'network', 'configuration'])(
		'logs %s failures without rejecting',
		async (failure) => {
			if (failure === 'api')
				mocks.create.mockResolvedValue({ error: { name: 'validation_error' } });
			if (failure === 'network') mocks.create.mockRejectedValue(new Error('Network unavailable'));
			if (failure === 'configuration') mocks.env.RESEND_API_KEY = '';
			await expect(syncResendContact(user)).resolves.toBeUndefined();
			expect(mocks.warn).toHaveBeenCalledOnce();
		}
	);
});
