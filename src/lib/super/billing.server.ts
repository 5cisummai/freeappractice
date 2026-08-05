import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { connectDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import { InsightReport, SuperBillingAccess, TutorProfile } from '$lib/super/models.server';
import { isSuperBillingStatus, type SuperBillingStatus } from '$lib/super/types';

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
};

let stripeClient: Stripe | null | undefined;

export function getStripeClient(): Stripe | null {
	if (stripeClient !== undefined) return stripeClient;
	const secret = env.STRIPE_SECRET_KEY?.trim();
	stripeClient = secret ? new Stripe(secret) : null;
	return stripeClient;
}

export async function mirrorSuperSubscription(input: SubscriptionMirror): Promise<void> {
	if (input.plan.toLowerCase() !== 'super') return;
	const status = input.status.toLowerCase();
	if (!isSuperBillingStatus(status)) {
		logger.warn('Ignoring Stripe subscription with an unsupported status', {
			userId: input.userId,
			status: input.status
		});
		return;
	}
	await connectDb();

	const now = new Date();
	const existing = input.stripeSubscriptionId
		? await SuperBillingAccess.findOne({ stripeSubscriptionId: input.stripeSubscriptionId }).exec()
		: null;
	const enteringPastDue = status === 'past_due' && existing?.status !== 'past_due';
	const isEnded = isTerminalSuperStatus(status);

	const set = {
		userId: input.userId,
		stripeCustomerId: input.stripeCustomerId,
		stripeSubscriptionId: input.stripeSubscriptionId,
		plan: 'super',
		status,
		...(input.periodStart ? { periodStart: input.periodStart } : {}),
		...(input.periodEnd ? { periodEnd: input.periodEnd } : {}),
		cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
		...(input.cancelAt ? { cancelAt: input.cancelAt } : {}),
		...(isEnded ? { superEndedAt: input.endedAt ?? now } : {}),
		...(enteringPastDue ? { pastDueSince: now } : {})
	};

	await SuperBillingAccess.findOneAndUpdate(
		input.stripeSubscriptionId
			? { stripeSubscriptionId: input.stripeSubscriptionId }
			: { userId: input.userId, plan: 'super' },
		{
			$set: set,
			$unset: {
				...(input.status !== 'past_due' ? { pastDueSince: 1 } : {}),
				...(!isEnded ? { superEndedAt: 1 } : {})
			}
		},
		{ upsert: true, new: true, setDefaultsOnInsert: true }
	).exec();

	if (isEnded) {
		await Promise.all([
			TutorProfile.updateOne(
				{ userId: input.userId },
				{ $set: { superEndedAt: input.endedAt ?? now } }
			).exec(),
			InsightReport.updateMany(
				{ userId: input.userId, lockedAt: { $exists: false } },
				{ $set: { lockedAt: now } }
			).exec()
		]);
	} else {
		await Promise.all([
			TutorProfile.updateOne({ userId: input.userId }, { $unset: { superEndedAt: 1 } }).exec(),
			InsightReport.updateMany(
				{ userId: input.userId, lockedAt: { $exists: true } },
				{ $unset: { lockedAt: 1 } }
			).exec()
		]);
	}
}

function isTerminalSuperStatus(status: SuperBillingStatus): boolean {
	return ['canceled', 'incomplete_expired', 'unpaid', 'paused'].includes(status);
}

export async function cancelStripeSubscriptionsForUser(userId: string): Promise<void> {
	const stripe = getStripeClient();
	if (!stripe) return;
	await connectDb();
	const subscriptions = await SuperBillingAccess.find({
		userId,
		stripeSubscriptionId: { $exists: true },
		status: { $nin: ['canceled', 'incomplete', 'incomplete_expired'] }
	})
		.lean()
		.exec();

	await Promise.all(
		subscriptions.map(async (subscription) => {
			if (!subscription.stripeSubscriptionId) return;
			await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
		})
	);
}
