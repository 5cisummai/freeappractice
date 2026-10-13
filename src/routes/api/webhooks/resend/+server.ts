import { type RequestHandler } from '@sveltejs/kit';
import { Resend, type WebhookEventPayload } from 'resend';
import { RESEND_WEBHOOK_SECRET } from '$app/env/private';
import { logger } from '#lib/server/logger.js';
import { processResendWebhook } from '#lib/server/email-delivery.server.js';

const resend = new Resend();

export const POST: RequestHandler = async ({ request }) => {
	const webhookSecret = RESEND_WEBHOOK_SECRET?.trim();
	if (!webhookSecret) {
		logger.error('Resend webhook secret is not configured');
		return Response.json({ error: 'Webhook is not configured' }, { status: 503 });
	}

	const id = request.headers.get('svix-id');
	const timestamp = request.headers.get('svix-timestamp');
	const signature = request.headers.get('svix-signature');
	if (!id || !timestamp || !signature) {
		return Response.json({ error: 'Missing webhook signature headers' }, { status: 400 });
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
		return Response.json({ error: 'Invalid webhook signature' }, { status: 400 });
	}

	try {
		const result = await processResendWebhook(id, event);
		return Response.json({ received: true, ...result });
	} catch (error) {
		logger.error('Resend webhook processing failed', { error });
		return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
	}
};
