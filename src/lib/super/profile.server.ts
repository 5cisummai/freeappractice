import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { InsightReport, TutorProfile, type ITutorProfile } from '$lib/super/models.server';
import type { TutorProfileUpdate, TutorProfileView } from '$lib/super/types';
import { getNeonDatabase } from '$lib/server/neon/db';
import { tutorProfileClasses, tutorTargetDates } from '$lib/server/neon/schema';
import { isDuplicateKeyError } from '$lib/questions/util.server';

const MAX_SELECTED_CLASSES = 20;
const MAX_TARGET_DATES = 20;

function toTutorProfileView(profile: ITutorProfile): TutorProfileView {
	return {
		ageConfirmedAt: profile.ageConfirmedAt?.toISOString() ?? null,
		selectedApClasses: [...profile.selectedApClasses],
		targetDates: profile.targetDates.map((target) => ({
			apClass: target.apClass,
			targetDate: target.targetDate.toISOString().slice(0, 10)
		})),
		studyAvailability: profile.studyAvailability,
		teachingStyle: profile.teachingStyle,
		memoryEnabled: profile.memoryEnabled,
		memoryDisclosureSeenAt: profile.memoryDisclosureSeenAt?.toISOString() ?? null
	};
}

async function hydrateTutorRelations(profile: ITutorProfile): Promise<ITutorProfile> {
	const db = getNeonDatabase() as any;
	const [classes, dates] = await Promise.all([
		db
			.select()
			.from(tutorProfileClasses as any)
			.where(eq((tutorProfileClasses as any).userId, profile.userId))
			.orderBy(asc((tutorProfileClasses as any).position)),
		db
			.select()
			.from(tutorTargetDates as any)
			.where(eq((tutorTargetDates as any).userId, profile.userId))
	]);
	profile.selectedApClasses = (classes as Array<{ apClass: string }>).map((row) => row.apClass);
	profile.targetDates = (dates as Array<{ apClass: string; targetDate: Date }>).map((row) => ({
		apClass: row.apClass,
		targetDate: row.targetDate
	}));
	return profile;
}

async function saveTutorProfile(profile: ITutorProfile): Promise<void> {
	await profile.save();
	const db = getNeonDatabase() as any;
	await db
		.delete(tutorProfileClasses as any)
		.where(eq((tutorProfileClasses as any).userId, profile.userId));
	if (profile.selectedApClasses.length) {
		await db
			.insert(tutorProfileClasses as any)
			.values(
				profile.selectedApClasses.map((apClass, position) => ({
					userId: profile.userId,
					apClass,
					position
				}))
			);
	}
	await db
		.delete(tutorTargetDates as any)
		.where(eq((tutorTargetDates as any).userId, profile.userId));
	if (profile.targetDates.length) {
		await db
			.insert(tutorTargetDates as any)
			.values(
				profile.targetDates.map((target) => ({
					userId: profile.userId,
					apClass: target.apClass,
					targetDate: target.targetDate
				}))
			);
	}
}

export async function ensureTutorProfile(userId: string): Promise<ITutorProfile> {
	const existing = await TutorProfile.findOne({ userId }).exec();
	if (existing) return hydrateTutorRelations(existing);

	try {
		return hydrateTutorRelations(await TutorProfile.create({ userId, mem0UserId: randomUUID() }));
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			const concurrent = await TutorProfile.findOne({ userId }).exec();
			if (concurrent) return hydrateTutorRelations(concurrent);
		}
		throw error;
	}
}

export async function getTutorProfileView(userId: string): Promise<TutorProfileView> {
	return toTutorProfileView(await ensureTutorProfile(userId));
}

export async function markSuperAccessStarted(
	userId: string,
	startedAt = new Date()
): Promise<void> {
	const profile = await ensureTutorProfile(userId);
	const shouldRestore = Boolean(profile.superEndedAt || profile.memoryPurgedAt);
	let changed = false;
	if (!profile.superAccessStartedAt) {
		profile.superAccessStartedAt = startedAt;
		changed = true;
	}
	if (shouldRestore) {
		profile.superEndedAt = undefined;
		profile.memoryPurgedAt = undefined;
		changed = true;
	}
	if (changed) await saveTutorProfile(profile);
	if (shouldRestore) {
		await InsightReport.updateMany(
			{ userId, lockedAt: { $exists: true } },
			{ $unset: { lockedAt: 1 } }
		).exec();
	}
}

export async function confirmAge(userId: string): Promise<TutorProfileView> {
	const profile = await ensureTutorProfile(userId);
	if (!profile.ageConfirmedAt) {
		profile.ageConfirmedAt = new Date();
		await saveTutorProfile(profile);
	}
	return toTutorProfileView(profile);
}

export class SuperFreeBetaUnavailableError extends Error {
	constructor(message = 'The free Super beta offer is not available.') {
		super(message);
		this.name = 'SuperFreeBetaUnavailableError';
	}
}

/** Persist an explicit free-beta claim. Idempotent once claimed. */
export async function claimSuperFreeBeta(
	userId: string,
	claimedAt = new Date()
): Promise<{ claimedAt: string }> {
	if (!(await isSuperFreeBetaEnabled())) {
		throw new SuperFreeBetaUnavailableError();
	}

	const profile = await ensureTutorProfile(userId);
	if (!profile.superFreeBetaClaimedAt) {
		profile.superFreeBetaClaimedAt = claimedAt;
		await profile.save();
	}
	await markSuperAccessStarted(userId, profile.superFreeBetaClaimedAt);
	return { claimedAt: profile.superFreeBetaClaimedAt.toISOString() };
}

export async function hasClaimedSuperFreeBeta(userId: string): Promise<boolean> {
	return Boolean(
		await TutorProfile.exists({
			userId,
			superFreeBetaClaimedAt: { $exists: true }
		}).exec()
	);
}

export async function markMemoryDisclosureSeen(userId: string): Promise<void> {
	const profile = await ensureTutorProfile(userId);
	let changed = false;
	if (!profile.memoryDisclosureSeenAt) {
		profile.memoryDisclosureSeenAt = new Date();
		changed = true;
	}
	if (!profile.superAccessStartedAt) {
		profile.superAccessStartedAt = profile.memoryDisclosureSeenAt ?? new Date();
		changed = true;
	}
	if (changed) await saveTutorProfile(profile);
}

export async function updateTutorProfile(
	userId: string,
	patch: TutorProfileUpdate
): Promise<TutorProfileView> {
	const profile = await ensureTutorProfile(userId);

	if (patch.selectedApClasses !== undefined) {
		profile.selectedApClasses = [...new Set(patch.selectedApClasses.map((value) => value.trim()))]
			.filter(Boolean)
			.slice(0, MAX_SELECTED_CLASSES);
	}
	if (patch.targetDates !== undefined) {
		profile.targetDates = patch.targetDates
			.map((target) => ({
				apClass: target.apClass.trim(),
				targetDate: new Date(target.targetDate)
			}))
			.filter((target) => target.apClass && Number.isFinite(target.targetDate.getTime()))
			.slice(0, MAX_TARGET_DATES);
	}
	if (patch.studyAvailability !== undefined) {
		profile.studyAvailability = patch.studyAvailability.trim().slice(0, 500);
	}
	if (patch.teachingStyle !== undefined) profile.teachingStyle = patch.teachingStyle;
	if (patch.memoryEnabled !== undefined) profile.memoryEnabled = patch.memoryEnabled;

	await saveTutorProfile(profile);
	return toTutorProfileView(profile);
}

export async function getMem0UserId(userId: string): Promise<string> {
	return (await ensureTutorProfile(userId)).mem0UserId;
}
