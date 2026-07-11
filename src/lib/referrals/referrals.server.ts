import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import { connectDb } from '$lib/server/db';
import { createReferralCode, UserProfile } from '$lib/users/model.server';
import { Referral } from '$lib/referrals/model.server';

const REFERRAL_COOKIE = 'freeap_referral';
const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type ReferralAttribution = {
	code: string;
	capturedAt: number;
};

function normalizeReferralCode(code: string): string {
	return code.trim();
}

export async function findReferrerByCode(code: string): Promise<string | null> {
	const normalizedCode = normalizeReferralCode(code);
	if (!normalizedCode || normalizedCode.length > 64) return null;

	await connectDb();
	const profile = await UserProfile.findOne({ referralCode: normalizedCode }).select('userId');
	return profile?.userId ?? null;
}

export function rememberReferralCode(cookies: Cookies, code: string): void {
	const attribution: ReferralAttribution = { code, capturedAt: Date.now() };
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
	referredUserId: string
): Promise<void> {
	const rawAttribution = cookies.get(REFERRAL_COOKIE);
	if (!rawAttribution) return;

	let attribution: ReferralAttribution;
	try {
		attribution = JSON.parse(rawAttribution) as ReferralAttribution;
	} catch {
		cookies.delete(REFERRAL_COOKIE, { path: '/' });
		return;
	}
	if (
		typeof attribution.code !== 'string' ||
		typeof attribution.capturedAt !== 'number' ||
		!Number.isFinite(attribution.capturedAt)
	) {
		cookies.delete(REFERRAL_COOKIE, { path: '/' });
		return;
	}

	const referrerUserId = await findReferrerByCode(attribution.code);
	cookies.delete(REFERRAL_COOKIE, { path: '/' });
	if (!referrerUserId || referrerUserId === referredUserId) return;

	const referredProfile = await UserProfile.findOne({ userId: referredUserId }).select('createdAt');
	if (!referredProfile || referredProfile.createdAt.getTime() < attribution.capturedAt) return;

	await Referral.updateOne(
		{ referredUserId },
		{ $setOnInsert: { referrerUserId, referredUserId } },
		{ upsert: true }
	);
}

export async function activateReferralForUser(referredUserId: string): Promise<void> {
	await connectDb();
	await Referral.updateOne(
		{ referredUserId, activatedAt: { $exists: false } },
		{ $set: { activatedAt: new Date() } }
	);
}

export async function getReferralSummary(userId: string): Promise<{
	referralCode: string;
	studentsHelped: number;
}> {
	await connectDb();
	const profile = await UserProfile.findOne({ userId }).select('referralCode');
	if (!profile) throw new Error('User profile not found');

	if (!profile.referralCode) {
		profile.referralCode = createReferralCode();
		await profile.save();
	}

	const studentsHelped = await Referral.countDocuments({
		referrerUserId: userId,
		activatedAt: { $exists: true }
	});

	return { referralCode: profile.referralCode, studentsHelped };
}
