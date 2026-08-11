import { randomBytes } from 'node:crypto';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import type {
	IPracticeExperimentAssignment,
	IProgress,
	IQuestionAttempt
} from '$lib/users/records.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	bookmarks,
	experimentAssignments,
	mcqAttempts,
	quizAttempts,
	userProfiles,
	userProgress,
	userSubjects
} from '$lib/server/neon/schema';

export function createReferralCode(): string {
	return randomBytes(9).toString('base64url');
}

/** Persist only the user's selected subjects instead of rewriting their full profile. */
export async function updateUserSubjects(userId: string, subjects: string[]): Promise<void> {
	const db = getNeonDatabase();
	const updateProfile = db
		.update(userProfiles)
		.set({ subjects, updatedAt: new Date() })
		.where(eq(userProfiles.userId, userId));
	const deleteSubjects = db.delete(userSubjects).where(eq(userSubjects.userId, userId));

	if (subjects.length) {
		const insertSubjects = db.insert(userSubjects).values(
			subjects.map((subject, position) => ({
				userId,
				subject,
				position
			}))
		);
		await db.batch([updateProfile, deleteSubjects, insertSubjects]);
		return;
	}

	await db.batch([updateProfile, deleteSubjects]);
}

/** Return the existing referral code or assign one with a single atomic update. */
export async function ensureUserReferralCode(userId: string): Promise<string> {
	const db = getNeonDatabase();
	const candidate = createReferralCode();
	const [profile] = await db
		.update(userProfiles)
		.set({ referralCode: sql`coalesce(${userProfiles.referralCode}, ${candidate})` })
		.where(eq(userProfiles.userId, userId))
		.returning({ referralCode: userProfiles.referralCode });

	if (!profile?.referralCode) throw new Error('User profile not found');
	return profile.referralCode;
}

export interface IUserProfile {
	userId: string;
	referralCode?: string;
	subjects: string[];
	progress: IProgress[];
	questionHistory: IQuestionAttempt[];
	bookmarkedQuestions: string[];
	practiceExperiments?: IPracticeExperimentAssignment[];
	createdAt: Date;
	updatedAt: Date;
}

type ProfileFilter = { userId?: string; referralCode?: string };

function whereFor(filter: ProfileFilter) {
	if (filter.userId) return eq(userProfiles.userId, filter.userId);
	if (filter.referralCode) return eq(userProfiles.referralCode, filter.referralCode);
	return undefined;
}

export async function createUserProfile(userId: string): Promise<void> {
	await getNeonDatabase()
		.insert(userProfiles)
		.values({ userId, referralCode: createReferralCode() })
		.onConflictDoNothing({ target: userProfiles.userId });
}

export async function getUserSubjects(userId: string): Promise<string[]> {
	const rows = await getNeonDatabase()
		.select({ subject: userSubjects.subject })
		.from(userSubjects)
		.where(eq(userSubjects.userId, userId))
		.orderBy(asc(userSubjects.position));
	return rows.map((row) => row.subject);
}

export async function getUserProgress(userId: string): Promise<IProgress[]> {
	const rows = await getNeonDatabase()
		.select()
		.from(userProgress)
		.where(eq(userProgress.userId, userId));
	return rows.map((row) => ({
		apClass: row.apClass,
		unit: row.unit,
		completed: row.completed,
		mastery: row.mastery,
		totalAttempts: row.totalAttempts,
		correctAttempts: row.correctAttempts,
		lastAttemptAt: row.lastAttemptAt ?? undefined,
		lastReviewedAt: row.lastReviewedAt ?? undefined
	}));
}

export type UserDashboardProfile = Pick<IUserProfile, 'subjects' | 'progress' | 'createdAt'>;

/** Read the small profile base used by dashboard aggregate queries. */
export async function getUserDashboardProfile(
	userId: string
): Promise<UserDashboardProfile | null> {
	const db = getNeonDatabase();
	const [profiles, subjects, progress] = await Promise.all([
		db
			.select({
				createdAt: userProfiles.createdAt
			})
			.from(userProfiles)
			.where(eq(userProfiles.userId, userId))
			.limit(1),
		getUserSubjects(userId),
		getUserProgress(userId)
	]);
	const profile = profiles[0];
	if (!profile) return null;
	return { subjects, progress, createdAt: profile.createdAt };
}

export async function countUserProfiles(filter: ProfileFilter = {}): Promise<number> {
	const [row] = await getNeonDatabase()
		.select({ count: sql<number>`count(*)::int` })
		.from(userProfiles)
		.where(whereFor(filter));
	return row?.count ?? 0;
}

export async function deleteUserProfiles(userIds: string[]): Promise<void> {
	if (!userIds.length) return;
	const db = getNeonDatabase();
	await db.batch([
		db.delete(userSubjects).where(inArray(userSubjects.userId, userIds)),
		db.delete(userProgress).where(inArray(userProgress.userId, userIds)),
		db.delete(mcqAttempts).where(inArray(mcqAttempts.userId, userIds)),
		db.delete(quizAttempts).where(inArray(quizAttempts.userId, userIds)),
		db.delete(bookmarks).where(inArray(bookmarks.userId, userIds)),
		db.delete(experimentAssignments).where(inArray(experimentAssignments.userId, userIds)),
		db.delete(userProfiles).where(inArray(userProfiles.userId, userIds))
	]);
}
