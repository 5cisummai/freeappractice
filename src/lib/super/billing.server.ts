import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';
import { getNeonDatabase } from '$lib/server/neon/db';
import { authSubscriptions, authUsers } from '$lib/server/neon/schema';
import { and, eq } from 'drizzle-orm';
import { SuperBillingAccess, TutorProfile } from '$lib/super/models.server';
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

export function shouldApplySubscriptionEvent(
	existing: { lastStripeEventId?: string; lastStripeEventCreated?: Date } | null,
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
	const existing = current.stripeSubscriptionId
		? await SuperBillingAccess.findOne({
				stripeSubscriptionId: current.stripeSubscriptionId
			}).exec()
		: null;
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

	await SuperBillingAccess.findOneAndUpdate(
		current.stripeSubscriptionId
			? { stripeSubscriptionId: current.stripeSubscriptionId }
			: { userId: current.userId, plan: 'super' },
		{
			$set: set,
			$unset: {
				...(status !== 'past_due' ? { pastDueSince: 1 } : {}),
				...(!isEnded ? { superEndedAt: 1 } : {})
			}
		},
		{ upsert: true, new: true, setDefaultsOnInsert: true }
	).exec();

	if (isEnded) {
		await markSuperAccessEndedIfNoAccess(current.userId, current.endedAt ?? now, now);
	} else if (status === 'active' || status === 'past_due') {
		const access = await getEntitlements(current.userId, now);
		if (access.plan !== 'super') return;
		await Promise.all([
			TutorProfile.updateOne(
				{ userId: current.userId },
				{ $unset: { superEndedAt: 1, memoryPurgedAt: 1 } }
			).exec(),
			unlockInsightReports(current.userId)
		]);
	}
}

export async function markSubscriptionBillingIssue(
	stripeSubscriptionId: string,
	issue: SuperBillingIssue | null,
	eventCreated: Date
): Promise<void> {
	const update = issue
		? {
				$set: {
					billingIssue: issue,
					billingIssueAt: eventCreated,
					lastBillingEventCreated: eventCreated
				}
			}
		: {
				$set: { lastBillingEventCreated: eventCreated },
				$unset: { billingIssue: 1, billingIssueAt: 1 }
			};
	await SuperBillingAccess.findOneAndUpdate(
		{
			stripeSubscriptionId,
			$or: [
				{ lastBillingEventCreated: { $exists: false } },
				{ lastBillingEventCreated: { $lte: eventCreated } }
			]
		},
		update,
		{ new: true }
	).exec();
}

function isTerminalSuperStatus(status: SuperBillingStatus): boolean {
	return ['canceled', 'incomplete_expired', 'unpaid', 'paused'].includes(status);
}

type StripeBillingRecord = {
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
};

async function findStripeBillingRecords(userId: string): Promise<StripeBillingRecord[]> {
	const [localRecords, authRecords] = await Promise.all([
		SuperBillingAccess.find({ userId, plan: 'super' })
			.select({ stripeCustomerId: 1, stripeSubscriptionId: 1 })
			.lean()
			.exec(),
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
