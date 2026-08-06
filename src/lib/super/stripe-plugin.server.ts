import { stripe as stripePlugin, type Subscription } from '@better-auth/stripe';
import { env } from '$env/dynamic/private';
import {
	getStripeClient,
	isSuperStripeConfigured,
	markSubscriptionBillingIssue,
	mirrorSuperSubscription
} from '$lib/super/billing.server';

function toSubscriptionMirror(subscription: Subscription, event?: { id: string; created: number }) {
	return {
		userId: subscription.referenceId,
		stripeCustomerId: subscription.stripeCustomerId,
		stripeSubscriptionId: subscription.stripeSubscriptionId,
		plan: subscription.plan,
		status: subscription.status,
		periodStart: subscription.periodStart,
		periodEnd: subscription.periodEnd,
		cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
		cancelAt: subscription.cancelAt,
		endedAt: subscription.endedAt,
		...(event
			? {
					eventId: event.id,
					eventCreated: new Date(event.created * 1000)
				}
			: {})
	};
}

/** Stripe is disabled until all credentials and both Super prices are configured. */
export function createSuperStripePlugin() {
	const stripeClient = getStripeClient();
	const monthlyPriceId = env.STRIPE_SUPER_MONTHLY_PRICE_ID?.trim();
	const annualPriceId = env.STRIPE_SUPER_ANNUAL_PRICE_ID?.trim();
	if (!stripeClient || !isSuperStripeConfigured() || !monthlyPriceId || !annualPriceId) return null;

	return stripePlugin({
		stripeClient,
		stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET!.trim(),
		createCustomerOnSignUp: false,
		schema: {
			subscription: { modelName: 'authSubscriptions' }
		},
		onEvent: async (event) => {
			const issue =
				event.type === 'invoice.finalization_failed'
					? 'invoice_finalization_failed'
					: event.type === 'invoice.payment_action_required'
						? 'payment_action_required'
						: event.type === 'invoice.payment_failed'
							? 'payment_failed'
							: event.type === 'invoice.paid'
								? null
								: undefined;
			if (issue === undefined) return;

			const invoice = event.data.object as {
				subscription?: string | { id: string } | null;
			};
			const subscriptionId =
				typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
			if (!subscriptionId) return;

			await markSubscriptionBillingIssue(subscriptionId, issue, new Date(event.created * 1000));
		},
		subscription: {
			enabled: true,
			requireEmailVerification: true,
			plans: [
				{
					name: 'super',
					priceId: monthlyPriceId,
					annualDiscountPriceId: annualPriceId,
					limits: { personalizedMessagesPerMonth: 600 }
				}
			],
			getCheckoutSessionParams: ({ subscription }) => ({
				params: {
					automatic_tax: { enabled: true },
					allow_promotion_codes: false
				},
				options: { idempotencyKey: `super-checkout:${subscription.id}` }
			}),
			onSubscriptionComplete: async ({ event, subscription }) => {
				await mirrorSuperSubscription(toSubscriptionMirror(subscription, event));
			},
			onSubscriptionCreated: async ({ event, subscription }) => {
				await mirrorSuperSubscription(toSubscriptionMirror(subscription, event));
			},
			onSubscriptionUpdate: async ({ event, subscription }) => {
				await mirrorSuperSubscription(toSubscriptionMirror(subscription, event));
			},
			onSubscriptionCancel: async ({ event, subscription }) => {
				await mirrorSuperSubscription(toSubscriptionMirror(subscription, event));
			},
			onSubscriptionDeleted: async ({ event, subscription }) => {
				await mirrorSuperSubscription(toSubscriptionMirror(subscription, event));
			}
		}
	});
}
