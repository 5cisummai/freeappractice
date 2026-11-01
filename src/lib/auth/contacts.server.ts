import { Resend } from 'resend';
import * as env from '$app/env/private';
import { logger } from '#lib/server/logger.js';

let resend: Resend | undefined;

/** Best-effort signup sync. Never change an existing contact's subscription status. */
export async function syncResendContact(user: { email: string; name: string }): Promise<void> {
	const segmentId = env.RESEND_SIGNUP_SEGMENT_ID?.trim();
	if (!segmentId) return;

	try {
		if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is required for contact sync');
		resend ??= new Resend(env.RESEND_API_KEY);
		const { error } = await resend.contacts.create({
			email: user.email,
			firstName: user.name,
			segments: [{ id: segmentId }]
		});
		if (error) throw new Error(`Resend contact sync failed: ${error.name}`);
	} catch (error) {
		logger.warn('Could not sync signup contact to Resend', { error });
	}
}
