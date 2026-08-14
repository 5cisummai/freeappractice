import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	authSubscriptions,
	authUsers,
	superBillingAccess,
	tutorProfiles
} from '$lib/server/neon/schema';
import { and, desc, eq, isNull, lte, or } from 'drizzle-orm';
import { getEntitlements, markSuperAccessEndedIfNoAccess } from '$lib/super/entitlements.server';
import { unlockInsightReports } from '$lib/super/insight-locks.server';
import {
	isSuperBillingStatus,
	type SuperBillingIssue,
	type SuperBillingStatus
} from '$lib/super/types';

export type SubscriptionMirror = {
	userId: string;
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
	plan: string;
	status: string;
	periodStart?: Date;
	periodEnd?: Date;
	cancelAtPeriodEnd?: boolean;
	cancelAt?: Date;
	endedAt?: Date;
	eventId?: string;
	eventCreated?: Date;
};

let stripeClient: Stripe | null | undefined;

export function getStripeClient(): Stripe | null {
	if (stripeClient !== undefined) return stripeClient;
	const secret = env.STRIPE_SECRET_KEY?.trim();
	stripeClient = secret ? new Stripe(secret) : null;
	return stripeClient;
}

export function isSuperStripeConfigured(): boolean {
	return Boolean(
		getStripeClient() &&
		env.STRIPE_WEBHOOK_SECRET?.trim() &&
		env.STRIPE_SUPER_MONTHLY_PRICE_ID?.trim() &&
		env.STRIPE_SUPER_ANNUAL_PRICE_ID?.trim()
	);
}

export type SuperBillingView = {
	status: string;
	billingIssue: string | null;
	subscriptionId: string | null;
	periodStart: string | null;
	periodEnd: string | null;
	cancelAt: string | null;
	cancelAtPeriodEnd: boolean;
	hasCustomer: boolean;
};

/** Keep the durable Stripe mirror and its page-facing shape inside billing. */
export async function getSuperBillingView(userId: string): Promise<SuperBillingView | null> {
	const [billing] = await getNeonDatabase()
		.select()
		.from(superBillingAccess)
		.where(and(eq(superBillingAccess.userId, userId), eq(superBillingAccess.plan, 'super')))
		.orderBy(desc(superBillingAccess.updatedAt))
		.limit(1);
	return billing
		? {
				status: billing.status,
				billingIssue: billing.billingIssue ?? null,
				subscriptionId: billing.stripeSubscriptionId ?? null,
				periodStart: billing.periodStart?.toISOString() ?? null,
				periodEnd: billing.periodEnd?.toISOString() ?? null,
				cancelAt: billing.cancelAt?.toISOString() ?? null,
				cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
				hasCustomer: Boolean(billing.stripeCustomerId)
			}
		: null;
}

export function shouldApplySubscriptionEvent(
	existing: { lastStripeEventId?: string | null; lastStripeEventCreated?: Date | null } | null,
	input: Pick<SubscriptionMirror, 'eventId' | 'eventCreated'>
): boolean {
	if (!existing) return true;
	if (input.eventId && existing.lastStripeEventId === input.eventId) return false;
	if (
		input.eventCreated &&
		existing.lastStripeEventCreated &&
		input.eventCreated < existing.lastStripeEventCreated
	) {
		return false;
	}
	return true;
}

function toDate(unixSeconds: number | null | undefined): Date | undefined {
	return typeof unixSeconds === 'number' && Number.isFinite(unixSeconds)
		? new Date(unixSeconds * 1000)
		: undefined;
}

function stripeCustomerId(
	value: string | Stripe.Customer | Stripe.DeletedCustomer
): string | undefined {
	return typeof value === 'string' ? value : value.id;
}

async function resolveCurrentSubscription(input: SubscriptionMirror): Promise<SubscriptionMirror> {
	const stripe = getStripeClient();
	if (!stripe || !input.stripeSubscriptionId) return input;

	const subscription = await stripe.subscriptions.retrieve(input.stripeSubscriptionId);
	const currentPeriod = subscription.items.data[0];
	return {
		...input,
		stripeCustomerId: stripeCustomerId(subscription.customer) ?? input.stripeCustomerId,
		status: subscription.status,
		periodStart: toDate(currentPeriod?.current_period_start) ?? input.periodStart,
		periodEnd: toDate(currentPeriod?.current_period_end) ?? input.periodEnd,
		cancelAtPeriodEnd: subscription.cancel_at_period_end,
		cancelAt: toDate(subscription.cancel_at),
		endedAt: toDate(subscription.ended_at)
	};
}

async function authUserExists(userId: string): Promise<boolean> {
	const db = getNeonDatabase();
	const rows = await db
		.select({ id: authUsers.id })
		.from(authUsers)
		.where(eq(authUsers.id, userId))
		.limit(1);
	return rows.length > 0;
}

export async function mirrorSuperSubscription(input: SubscriptionMirror): Promise<void> {
	if (input.plan.toLowerCase() !== 'super') return;
	const current = await resolveCurrentSubscription(input);
	const status = current.status.toLowerCase();
	if (!isSuperBillingStatus(status)) {
		logger.warn('Ignoring Stripe subscription with an unsupported status', {
			resource: 'subscription',
			status: current.status
		});
		return;
	}
	if (!(await authUserExists(current.userId))) {
		logger.warn('Ignoring Stripe subscription for a deleted Better Auth user', {
			resource: 'subscription',
			stripeSubscriptionId: current.stripeSubscriptionId
		});
		return;
	}

	const now = new Date();
	const db = getNeonDatabase();
	const [existing] = await db
		.select()
		.from(superBillingAccess)
		.where(
			current.stripeSubscriptionId
				? eq(superBillingAccess.stripeSubscriptionId, current.stripeSubscriptionId)
				: and(eq(superBillingAccess.userId, current.userId), eq(superBillingAccess.plan, 'super'))
		)
		.limit(1);
	if (!shouldApplySubscriptionEvent(existing, current)) return;

	const enteringPastDue = status === 'past_due' && existing?.status !== 'past_due';
	const isEnded = isTerminalSuperStatus(status);

	const set = {
		userId: current.userId,
		stripeCustomerId: current.stripeCustomerId,
		stripeSubscriptionId: current.stripeSubscriptionId,
		plan: 'super',
		status,
		...(current.periodStart ? { periodStart: current.periodStart } : {}),
		...(current.periodEnd ? { periodEnd: current.periodEnd } : {}),
		cancelAtPeriodEnd: Boolean(current.cancelAtPeriodEnd),
		...(current.cancelAt ? { cancelAt: current.cancelAt } : {}),
		...(isEnded ? { superEndedAt: current.endedAt ?? now } : {}),
		...(enteringPastDue ? { pastDueSince: now } : {}),
		...(current.eventId ? { lastStripeEventId: current.eventId } : {}),
		...(current.eventCreated ? { lastStripeEventCreated: current.eventCreated } : {})
	};

	const values = {
		...set,
		pastDueSince: status === 'past_due' ? (existing?.pastDueSince ?? now) : null,
		superEndedAt: isEnded ? (current.endedAt ?? now) : null,
		updatedAt: now
	};
	if (existing) {
		await db.update(superBillingAccess).set(values).where(eq(superBillingAccess.id, existing.id));
	} else {
		await db.insert(superBillingAccess).values({ id: randomUUID(), ...values });
	}

	if (isEnded) {
		await markSuperAccessEndedIfNoAccess(current.userId, current.endedAt ?? now, now);
	} else if (status === 'active' || status === 'past_due') {
		const access = await getEntitlements(current.userId, now);
		if (access.plan !== 'super') return;
		await Promise.all([
			db
				.update(tutorProfiles)
				.set({ superEndedAt: null, memoryPurgedAt: null, updatedAt: new Date() })
				.where(eq(tutorProfiles.userId, current.userId)),
			unlockInsightReports(current.userId)
		]);
	}
}

export async function markSubscriptionBillingIssue(
	stripeSubscriptionId: string,
	issue: SuperBillingIssue | null,
	eventCreated: Date
): Promise<void> {
	const db = getNeonDatabase();
	const [existing] = await db
		.select({ id: superBillingAccess.id })
		.from(superBillingAccess)
		.where(
			and(
				eq(superBillingAccess.stripeSubscriptionId, stripeSubscriptionId),
				or(
					isNull(superBillingAccess.lastBillingEventCreated),
					lte(superBillingAccess.lastBillingEventCreated, eventCreated)
				)
			)
		)
		.limit(1);
	if (!existing) return;
	await db
		.update(superBillingAccess)
		.set(
			issue
				? {
						billingIssue: issue,
						billingIssueAt: eventCreated,
						lastBillingEventCreated: eventCreated,
						updatedAt: eventCreated
					}
				: {
						billingIssue: null,
						billingIssueAt: null,
						lastBillingEventCreated: eventCreated,
						updatedAt: eventCreated
					}
		)
		.where(eq(superBillingAccess.id, existing.id));
}

function isTerminalSuperStatus(status: SuperBillingStatus): boolean {
	return ['canceled', 'incomplete_expired', 'unpaid', 'paused'].includes(status);
}

type StripeBillingRecord = {
	stripeCustomerId?: string | null;
	stripeSubscriptionId?: string | null;
};

async function findStripeBillingRecords(userId: string): Promise<StripeBillingRecord[]> {
	const [localRecords, authRecords] = await Promise.all([
		getNeonDatabase()
			.select({
				stripeCustomerId: superBillingAccess.stripeCustomerId,
				stripeSubscriptionId: superBillingAccess.stripeSubscriptionId
			})
			.from(superBillingAccess)
			.where(and(eq(superBillingAccess.userId, userId), eq(superBillingAccess.plan, 'super'))),
		getNeonDatabase()
			.select({
				stripeCustomerId: authSubscriptions.stripeCustomerId,
				stripeSubscriptionId: authSubscriptions.stripeSubscriptionId
			})
			.from(authSubscriptions)
			.where(and(eq(authSubscriptions.referenceId, userId), eq(authSubscriptions.plan, 'super')))
	]);
	return [
		...localRecords,
		...authRecords.map((record) => ({
			stripeCustomerId: record.stripeCustomerId ?? undefined,
			stripeSubscriptionId: record.stripeSubscriptionId ?? undefined
		}))
	];
}

export async function cancelStripeSubscriptionsForUser(
	userId: string,
	knownStripeCustomerId?: string
): Promise<void> {
	const records = await findStripeBillingRecords(userId);
	const stripe = getStripeClient();
	if (!stripe) {
		if (knownStripeCustomerId || records.length > 0) {
			throw new Error('Stripe billing is unavailable while deleting an account');
		}
		return;
	}

	const customerIds = [
		...new Set(
			[...records, ...(knownStripeCustomerId ? [{ stripeCustomerId: knownStripeCustomerId }] : [])]
				.map((record) => record.stripeCustomerId)
				.filter((customerId): customerId is string => Boolean(customerId))
		)
	];
	const subscriptionIds = [
		...new Set(
			records
				.map((record) => record.stripeSubscriptionId)
				.filter((subscriptionId): subscriptionId is string => Boolean(subscriptionId))
		)
	];

	if (!subscriptionIds.length) {
		for (const customer of customerIds) {
			const subscriptions = await stripe.subscriptions.list({
				customer,
				status: 'all',
				limit: 100
			});
			if (
				subscriptions.data.some(
					(subscription) =>
						subscription.status !== 'canceled' && subscription.status !== 'incomplete_expired'
				)
			) {
				throw new Error('Could not identify all Stripe subscriptions for account deletion');
			}
		}
		return;
	}

	for (const subscriptionId of subscriptionIds) {
		const subscription = await stripe.subscriptions.retrieve(subscriptionId);
		const customer = stripeCustomerId(subscription.customer);
		if (customerIds.length && customer && !customerIds.includes(customer)) {
			throw new Error('Stripe subscription does not belong to the deleting account');
		}
		if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired')
			continue;
		await stripe.subscriptions.cancel(subscription.id);
	}
}
