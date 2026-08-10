import { dev } from '$app/environment';
import { randomUUID } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { mcqAttempts, referrals, userProfiles } from '$lib/server/neon/schema';
import { ensureUserReferralCode } from '$lib/users/model.server';
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

	const [profile] = await getNeonDatabase()
		.select({ userId: userProfiles.userId })
		.from(userProfiles)
		.where(eq(userProfiles.referralCode, normalizedCode))
		.limit(1);
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

	const db = getNeonDatabase();
	const [[referredProfile], [attempts]] = await Promise.all([
		db
			.select({ createdAt: userProfiles.createdAt })
			.from(userProfiles)
			.where(eq(userProfiles.userId, referredUserId))
			.limit(1),
		db
			.select({ count: sql<number>`count(*)` })
			.from(mcqAttempts)
			.where(eq(mcqAttempts.userId, referredUserId))
	]);
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

	const attemptCount = Number(attempts?.count ?? 0);
	const activateNow = shouldActivateOnClaim(attemptCount);
	const [insertedReferral] = await db
		.insert(referrals)
		.values({
			id: randomUUID(),
			referrerUserId,
			referredUserId,
			...(activateNow ? { activatedAt: new Date() } : {})
		})
		.onConflictDoNothing({ target: referrals.referredUserId })
		.returning({ id: referrals.id });

	const inserted = Boolean(insertedReferral);
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
	const [activated] = await getNeonDatabase()
		.update(referrals)
		.set({ activatedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(referrals.referredUserId, referredUserId), isNull(referrals.activatedAt)))
		.returning({ id: referrals.id });

	if (!activated) return;

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
	const referralCode = await ensureUserReferralCode(userId);

	const [summary] = await getNeonDatabase()
		.select({
			studentsHelped: sql<number>`count(*) filter (where ${referrals.activatedAt} is not null)`,
			pendingInvites: sql<number>`count(*) filter (where ${referrals.activatedAt} is null)`
		})
		.from(referrals)
		.where(eq(referrals.referrerUserId, userId));

	return {
		referralCode,
		studentsHelped: Number(summary?.studentsHelped ?? 0),
		pendingInvites: Number(summary?.pendingInvites ?? 0)
	};
}

export function captureInviteLanded(codeValid: boolean): void {
	captureAnonymousServerMetric(REFERRAL_EVENTS.inviteLanded, {
		code_valid: codeValid
	});
}
