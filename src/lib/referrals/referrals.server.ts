import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import { connectDb } from '$lib/server/db';
import { createReferralCode, UserProfile } from '$lib/users/model.server';
import { Referral } from '$lib/referrals/model.server';
import {
	canAttributeReferral,
	isValidReferralCodeShape,
	normalizeReferralCode,
	parseReferralAttribution,
	shouldActivateOnClaim,
	type ReferralAttribution
} from '$lib/referrals/attribution';
import { captureAnonymousServerMetric, capturePostHogServerEvent } from '$lib/server/posthog';

const REFERRAL_COOKIE = 'freeap_referral';
const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const REFERRAL_EVENTS = {
	inviteLanded: 'invite_landed',
	referralClaimed: 'referral_claimed',
	referralActivated: 'referral_activated'
} as const;

export async function findReferrerByCode(code: string): Promise<string | null> {
	const normalizedCode = normalizeReferralCode(code);
	if (!isValidReferralCodeShape(normalizedCode)) return null;

	await connectDb();
	const profile = await UserProfile.findOne({ referralCode: normalizedCode }).select('userId');
	return profile?.userId ?? null;
}

export function rememberReferralCode(cookies: Cookies, code: string): void {
	const attribution: ReferralAttribution = {
		code: normalizeReferralCode(code),
		capturedAt: Date.now()
	};
	cookies.set(REFERRAL_COOKIE, JSON.stringify(attribution), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS
	});
}

export async function claimReferralFromCookie(
	cookies: Cookies,
	referredUserId: string,
	request?: Request
): Promise<void> {
	const rawAttribution = cookies.get(REFERRAL_COOKIE);
	if (!rawAttribution) return;

	const attribution = parseReferralAttribution(rawAttribution);
	if (!attribution) {
		cookies.delete(REFERRAL_COOKIE, { path: '/' });
		return;
	}

	const referrerUserId = await findReferrerByCode(attribution.code);
	cookies.delete(REFERRAL_COOKIE, { path: '/' });
	if (!referrerUserId) return;

	await connectDb();
	const referredProfile = await UserProfile.findOne({ userId: referredUserId }).select(
		'createdAt questionHistory'
	);
	if (
		!referredProfile ||
		!canAttributeReferral({
			referrerUserId,
			referredUserId,
			profileCreatedAtMs: referredProfile.createdAt.getTime(),
			capturedAtMs: attribution.capturedAt
		})
	) {
		return;
	}

	const attemptCount = referredProfile.questionHistory?.length ?? 0;
	const activateNow = shouldActivateOnClaim(attemptCount);
	const result = await Referral.updateOne(
		{ referredUserId },
		{
			$setOnInsert: {
				referrerUserId,
				referredUserId,
				...(activateNow ? { activatedAt: new Date() } : {})
			}
		},
		{ upsert: true }
	);

	const inserted = result.upsertedCount > 0;
	if (!inserted) {
		if (activateNow) {
			await activateReferralForUser(referredUserId, request);
		}
		return;
	}

	if (request) {
		capturePostHogServerEvent(request, {
			distinctId: referredUserId,
			event: REFERRAL_EVENTS.referralClaimed,
			properties: {
				activated_on_claim: activateNow
			}
		});
	}

	if (activateNow && request) {
		capturePostHogServerEvent(request, {
			distinctId: referredUserId,
			event: REFERRAL_EVENTS.referralActivated,
			properties: {
				source: 'claim_backfill'
			}
		});
	} else if (activateNow) {
		captureAnonymousServerMetric(REFERRAL_EVENTS.referralActivated, {
			source: 'claim_backfill'
		});
	}
}

export async function activateReferralForUser(
	referredUserId: string,
	request?: Request
): Promise<void> {
	await connectDb();
	const result = await Referral.updateOne(
		{ referredUserId, activatedAt: { $exists: false } },
		{ $set: { activatedAt: new Date() } }
	);

	if (result.modifiedCount === 0) return;

	if (request) {
		capturePostHogServerEvent(request, {
			distinctId: referredUserId,
			event: REFERRAL_EVENTS.referralActivated,
			properties: {
				source: 'first_attempt'
			}
		});
	}
}

export async function getReferralSummary(userId: string): Promise<{
	referralCode: string;
	studentsHelped: number;
	pendingInvites: number;
}> {
	await connectDb();
	const profile = await UserProfile.findOne({ userId }).select('referralCode');
	if (!profile) throw new Error('User profile not found');

	if (!profile.referralCode) {
		profile.referralCode = createReferralCode();
		await profile.save();
	}

	const [studentsHelped, pendingInvites] = await Promise.all([
		Referral.countDocuments({
			referrerUserId: userId,
			activatedAt: { $exists: true }
		}),
		Referral.countDocuments({
			referrerUserId: userId,
			activatedAt: { $exists: false }
		})
	]);

	return { referralCode: profile.referralCode, studentsHelped, pendingInvites };
}

export function captureInviteLanded(codeValid: boolean): void {
	captureAnonymousServerMetric(REFERRAL_EVENTS.inviteLanded, {
		code_valid: codeValid
	});
}
