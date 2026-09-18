import { and, eq } from 'drizzle-orm';
import type { WebhookEventPayload } from 'resend';
import {
	EMAIL_DELIVERY_HEADER,
	EMAIL_DELIVERY_TAG,
	type EmailDeliveryStatus,
	type EmailDeliveryType,
	isEmailDeliveryId
} from '$lib/auth/email-delivery';
import { logger } from '$lib/server/logger';
import { getNeonDatabase } from '$lib/server/neon/db';
import { emailDeliveries, resendWebhookEvents } from '$lib/server/neon/schema';

const db = new Proxy({} as ReturnType<typeof getNeonDatabase>, {
	get: (_target, property) => {
		const database = getNeonDatabase();
		const value = Reflect.get(database, property, database);
		return typeof value === 'function' ? value.bind(database) : value;
	}
});

export type EmailDeliveryContext = {
	id: string;
	type: EmailDeliveryType;
};

export function getEmailDeliveryContext(
	request: Request | undefined,
	type: EmailDeliveryType
): EmailDeliveryContext | undefined {
	const id = request?.headers.get(EMAIL_DELIVERY_HEADER)?.trim();
	return isEmailDeliveryId(id) ? { id, type } : undefined;
}

export async function createPendingEmailDelivery(context: EmailDeliveryContext): Promise<void> {
	await db
		.insert(emailDeliveries)
		.values({ id: context.id, emailType: context.type })
		.onConflictDoNothing();
}

export async function markEmailDeliveryAccepted(id: string, resendEmailId: string): Promise<void> {
	await db
		.update(emailDeliveries)
		.set({ resendEmailId, updatedAt: new Date() })
		.where(eq(emailDeliveries.id, id));
}

export async function markEmailDeliveryFailed(id: string): Promise<void> {
	await db
		.update(emailDeliveries)
		.set({ status: 'failed', updatedAt: new Date() })
		.where(eq(emailDeliveries.id, id));
}

export async function getEmailDeliveryStatus(
	id: string
): Promise<{ emailType: EmailDeliveryType; status: EmailDeliveryStatus } | null> {
	const [delivery] = await db
		.select({ emailType: emailDeliveries.emailType, status: emailDeliveries.status })
		.from(emailDeliveries)
		.where(eq(emailDeliveries.id, id))
		.limit(1);

	if (!delivery) return null;
	return {
		emailType: delivery.emailType as EmailDeliveryType,
		status: delivery.status as EmailDeliveryStatus
	};
}

function isEmailEvent(event: WebhookEventPayload): boolean {
	return event.type.startsWith('email.');
}

function eventStatus(type: string): EmailDeliveryStatus | null {
	if (
		['email.sent', 'email.delivered', 'email.opened', 'email.clicked', 'email.received'].includes(
			type
		)
	) {
		return 'sent';
	}
	if (['email.bounced', 'email.complained', 'email.failed', 'email.suppressed'].includes(type)) {
		return 'failed';
	}
	return null;
}

/** Record one verified Resend event and apply it once to the tracked delivery. */
export async function processResendWebhook(
	svixId: string,
	event: WebhookEventPayload
): Promise<{ duplicate: boolean; tracked: boolean }> {
	if (!isEmailEvent(event)) return { duplicate: false, tracked: false };

	const data = event.data as { email_id: string; tags?: Record<string, string> };
	const deliveryId = data.tags?.[EMAIL_DELIVERY_TAG];
	if (!isEmailDeliveryId(deliveryId)) return { duplicate: false, tracked: false };

	const inserted = await db
		.insert(resendWebhookEvents)
		.values({
			svixId,
			deliveryId,
			resendEmailId: data.email_id,
			eventType: event.type,
			eventCreatedAt: parseEventDate(event.created_at)
		})
		.onConflictDoNothing()
		.returning({ svixId: resendWebhookEvents.svixId });

	if (inserted.length === 0) return { duplicate: true, tracked: true };

	const status = eventStatus(event.type);
	if (!status) {
		await db
			.update(emailDeliveries)
			.set({ lastEventType: event.type, updatedAt: new Date() })
			.where(and(eq(emailDeliveries.id, deliveryId), eq(emailDeliveries.status, 'pending')));
		return { duplicate: false, tracked: true };
	}

	await db
		.update(emailDeliveries)
		.set({ status, lastEventType: event.type, updatedAt: new Date() })
		.where(
			and(
				eq(emailDeliveries.id, deliveryId),
				eq(emailDeliveries.status, 'pending')
			)
		);

	return { duplicate: false, tracked: true };
}

export async function recordEmailDeliveryFailure(id: string, error: unknown): Promise<void> {
	try {
		await markEmailDeliveryFailed(id);
	} catch (markError) {
		logger.warn('Could not record email delivery failure', { error: markError });
	}
	logger.warn('Email provider send failed', { error });
}

function parseEventDate(value: string): Date {
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
