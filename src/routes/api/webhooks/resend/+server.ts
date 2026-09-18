import { json, type RequestHandler } from '@sveltejs/kit';
import { Resend, type WebhookEventPayload } from 'resend';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';
import { processResendWebhook } from '$lib/server/email-delivery.server';

const resend = new Resend();

export const POST: RequestHandler = async ({ request }) => {
	const webhookSecret = env.RESEND_WEBHOOK_SECRET?.trim();
	if (!webhookSecret) {
		logger.error('Resend webhook secret is not configured');
		return json({ error: 'Webhook is not configured' }, { status: 503 });
	}

	const id = request.headers.get('svix-id');
	const timestamp = request.headers.get('svix-timestamp');
	const signature = request.headers.get('svix-signature');
	if (!id || !timestamp || !signature) {
		return json({ error: 'Missing webhook signature headers' }, { status: 400 });
	}

	const payload = await request.text();
	let event: WebhookEventPayload;
	try {
		event = resend.webhooks.verify({
			payload,
			headers: { id, timestamp, signature },
			webhookSecret
		});
	} catch (error) {
		logger.warn('Invalid Resend webhook signature', { error });
		return json({ error: 'Invalid webhook signature' }, { status: 400 });
	}

	try {
		const result = await processResendWebhook(id, event);
		return json({ received: true, ...result });
	} catch (error) {
		logger.error('Resend webhook processing failed', { error });
		return json({ error: 'Webhook processing failed' }, { status: 500 });
	}
};
