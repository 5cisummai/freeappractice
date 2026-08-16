import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { unlockInsightReports } from '$lib/super/insight-locks.server';
import type { TutorProfileUpdate, TutorProfileView, TutorTeachingStyle } from '$lib/super/types';
import { getNeonDatabase } from '$lib/server/neon/db';
import { tutorProfileClasses, tutorProfiles, tutorTargetDates } from '$lib/server/neon/schema';
import { isDuplicateKeyError } from '$lib/question-bank/util.server';
import {
	InvalidBirthDateError,
	UnderAgeError,
	isAtLeastAge,
	isValidBirthDate
} from '$lib/auth/age';

const MAX_SELECTED_CLASSES = 20;
const MAX_TARGET_DATES = 20;

type TutorProfileRecord = {
	userId: string;
	ageConfirmedAt: Date | null;
	mem0UserId: string;
	selectedApClasses: string[];
	targetDates: Array<{ apClass: string; targetDate: Date }>;
	studyAvailability: string;
	teachingStyle: TutorTeachingStyle;
	memoryEnabled: boolean;
	memoryDisclosureSeenAt: Date | null;
	superFreeBetaClaimedAt: Date | null;
	superAccessStartedAt: Date | null;
	superEndedAt: Date | null;
	memoryPurgedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

function toTutorProfileRecord(row: typeof tutorProfiles.$inferSelect): TutorProfileRecord {
	return {
		...row,
		teachingStyle: row.teachingStyle as TutorTeachingStyle,
		selectedApClasses: [],
		targetDates: []
	};
}

function toTutorProfileView(profile: TutorProfileRecord): TutorProfileView {
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

async function hydrateTutorRelations(profile: TutorProfileRecord): Promise<TutorProfileRecord> {
	const db = getNeonDatabase();
	const [classes, dates] = await Promise.all([
		db
			.select()
			.from(tutorProfileClasses)
			.where(eq(tutorProfileClasses.userId, profile.userId))
			.orderBy(asc(tutorProfileClasses.position)),
		db.select().from(tutorTargetDates).where(eq(tutorTargetDates.userId, profile.userId))
	]);
	profile.selectedApClasses = classes.map((row) => row.apClass);
	profile.targetDates = dates.map((row) => ({
		apClass: row.apClass,
		targetDate: row.targetDate
	}));
	return profile;
}

export async function ensureTutorProfile(userId: string): Promise<TutorProfileRecord> {
	const db = getNeonDatabase();
	const [existing] = await db
		.select()
		.from(tutorProfiles)
		.where(eq(tutorProfiles.userId, userId))
		.limit(1);
	if (existing) return hydrateTutorRelations(toTutorProfileRecord(existing));

	try {
		const [created] = await db
			.insert(tutorProfiles)
			.values({ userId, mem0UserId: randomUUID() })
			.returning();
		if (!created) throw new Error('Tutor profile insert returned no row');
		return hydrateTutorRelations(toTutorProfileRecord(created));
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			const [concurrent] = await db
				.select()
				.from(tutorProfiles)
				.where(eq(tutorProfiles.userId, userId))
				.limit(1);
			if (concurrent) return hydrateTutorRelations(toTutorProfileRecord(concurrent));
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
		profile.superEndedAt = null;
		profile.memoryPurgedAt = null;
		changed = true;
	}
	if (changed) {
		profile.updatedAt = new Date();
		await getNeonDatabase()
			.update(tutorProfiles)
			.set({
				superAccessStartedAt: profile.superAccessStartedAt ?? null,
				superEndedAt: profile.superEndedAt ?? null,
				memoryPurgedAt: profile.memoryPurgedAt ?? null,
				updatedAt: profile.updatedAt
			})
			.where(eq(tutorProfiles.userId, userId));
	}
	if (shouldRestore) {
		await unlockInsightReports(userId);
	}
}

export async function confirmAge(userId: string, birthDate?: string): Promise<TutorProfileView> {
	const profile = await ensureTutorProfile(userId);
	if (profile.ageConfirmedAt) return toTutorProfileView(profile);
	if (!birthDate || !isValidBirthDate(birthDate)) throw new InvalidBirthDateError();
	if (!isAtLeastAge(birthDate)) throw new UnderAgeError();
	profile.ageConfirmedAt = new Date();
	profile.updatedAt = profile.ageConfirmedAt;
	await getNeonDatabase()
		.update(tutorProfiles)
		.set({ ageConfirmedAt: profile.ageConfirmedAt, updatedAt: profile.updatedAt })
		.where(and(eq(tutorProfiles.userId, userId), isNull(tutorProfiles.ageConfirmedAt)));
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
		const claimed = await getNeonDatabase()
			.update(tutorProfiles)
			.set({ superFreeBetaClaimedAt: claimedAt, updatedAt: claimedAt })
			.where(and(eq(tutorProfiles.userId, userId), isNull(tutorProfiles.superFreeBetaClaimedAt)))
			.returning({ claimedAt: tutorProfiles.superFreeBetaClaimedAt });
		profile.superFreeBetaClaimedAt = claimed[0]?.claimedAt ?? null;
		if (!profile.superFreeBetaClaimedAt) {
			const [current] = await getNeonDatabase()
				.select({ claimedAt: tutorProfiles.superFreeBetaClaimedAt })
				.from(tutorProfiles)
				.where(eq(tutorProfiles.userId, userId))
				.limit(1);
			profile.superFreeBetaClaimedAt = current?.claimedAt ?? claimedAt;
		}
	}
	const effectiveClaimedAt = profile.superFreeBetaClaimedAt ?? claimedAt;
	await markSuperAccessStarted(userId, effectiveClaimedAt);
	return { claimedAt: effectiveClaimedAt.toISOString() };
}

export async function hasClaimedSuperFreeBeta(userId: string): Promise<boolean> {
	const [profile] = await getNeonDatabase()
		.select({ userId: tutorProfiles.userId })
		.from(tutorProfiles)
		.where(and(eq(tutorProfiles.userId, userId), isNotNull(tutorProfiles.superFreeBetaClaimedAt)))
		.limit(1);
	return Boolean(profile);
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
	if (changed) {
		profile.updatedAt = new Date();
		await getNeonDatabase()
			.update(tutorProfiles)
			.set({
				memoryDisclosureSeenAt: profile.memoryDisclosureSeenAt ?? null,
				superAccessStartedAt: profile.superAccessStartedAt ?? null,
				updatedAt: profile.updatedAt
			})
			.where(eq(tutorProfiles.userId, userId));
	}
}

export async function updateTutorProfile(
	userId: string,
	patch: TutorProfileUpdate
): Promise<TutorProfileView> {
	const profile = await ensureTutorProfile(userId);
	const db = getNeonDatabase();
	const writes: BatchItem<'pg'>[] = [];

	if (patch.selectedApClasses !== undefined) {
		profile.selectedApClasses = [...new Set(patch.selectedApClasses.map((value) => value.trim()))]
			.filter(Boolean)
			.slice(0, MAX_SELECTED_CLASSES);
		writes.push(db.delete(tutorProfileClasses).where(eq(tutorProfileClasses.userId, userId)));
		if (profile.selectedApClasses.length) {
			writes.push(
				db
					.insert(tutorProfileClasses)
					.values(
						profile.selectedApClasses.map((apClass, position) => ({ userId, apClass, position }))
					)
			);
		}
	}
	if (patch.targetDates !== undefined) {
		profile.targetDates = patch.targetDates
			.map((target) => ({
				apClass: target.apClass.trim(),
				targetDate: new Date(target.targetDate)
			}))
			.filter((target) => target.apClass && Number.isFinite(target.targetDate.getTime()))
			.slice(0, MAX_TARGET_DATES);
		writes.push(db.delete(tutorTargetDates).where(eq(tutorTargetDates.userId, userId)));
		if (profile.targetDates.length) {
			writes.push(
				db
					.insert(tutorTargetDates)
					.values(profile.targetDates.map((target) => ({ userId, ...target })))
			);
		}
	}
	if (patch.studyAvailability !== undefined) {
		profile.studyAvailability = patch.studyAvailability.trim().slice(0, 500);
	}
	if (patch.teachingStyle !== undefined) profile.teachingStyle = patch.teachingStyle;
	if (patch.memoryEnabled !== undefined) profile.memoryEnabled = patch.memoryEnabled;

	if (
		writes.length > 0 ||
		patch.studyAvailability !== undefined ||
		patch.teachingStyle !== undefined ||
		patch.memoryEnabled !== undefined
	) {
		profile.updatedAt = new Date();
		writes.unshift(
			db
				.update(tutorProfiles)
				.set({
					...(patch.studyAvailability !== undefined && {
						studyAvailability: profile.studyAvailability
					}),
					...(patch.teachingStyle !== undefined && { teachingStyle: profile.teachingStyle }),
					...(patch.memoryEnabled !== undefined && { memoryEnabled: profile.memoryEnabled }),
					updatedAt: profile.updatedAt
				})
				.where(eq(tutorProfiles.userId, userId))
		);
	}
	if (writes.length) {
		await db.batch(writes as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
	}
	return toTutorProfileView(profile);
}

export async function getMem0UserId(userId: string): Promise<string> {
	return (await ensureTutorProfile(userId)).mem0UserId;
}
