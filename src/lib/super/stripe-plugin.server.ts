import { stripe as stripePlugin, type Subscription } from '@better-auth/stripe';
import { env } from '$env/dynamic/private';
import { getStripeClient, mirrorSuperSubscription } from '$lib/super/billing.server';

function toSubscriptionMirror(subscription: Subscription) {
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
		endedAt: subscription.endedAt
	};
}

/** Stripe is disabled until all credentials and both Super prices are configured. */
export function createSuperStripePlugin() {
	const stripeClient = getStripeClient();
	const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
	const monthlyPriceId = env.STRIPE_SUPER_MONTHLY_PRICE_ID?.trim();
	const annualPriceId = env.STRIPE_SUPER_ANNUAL_PRICE_ID?.trim();
	if (!stripeClient || !webhookSecret || !monthlyPriceId || !annualPriceId) return null;

	return stripePlugin({
		stripeClient,
		stripeWebhookSecret: webhookSecret,
		createCustomerOnSignUp: false,
		schema: {
			subscription: { modelName: 'authSubscriptions' }
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
			getCheckoutSessionParams: () => ({
				params: {
					automatic_tax: { enabled: true },
					allow_promotion_codes: false
				}
			}),
			onSubscriptionComplete: async ({ subscription }) => {
				await mirrorSuperSubscription(toSubscriptionMirror(subscription));
			},
			onSubscriptionCreated: async ({ subscription }) => {
				await mirrorSuperSubscription(toSubscriptionMirror(subscription));
			},
			onSubscriptionUpdate: async ({ subscription }) => {
				await mirrorSuperSubscription(toSubscriptionMirror(subscription));
			},
			onSubscriptionCancel: async ({ subscription }) => {
				await mirrorSuperSubscription(toSubscriptionMirror(subscription));
			},
			onSubscriptionDeleted: async ({ subscription }) => {
				await mirrorSuperSubscription(toSubscriptionMirror(subscription));
			}
		}
	});
}
