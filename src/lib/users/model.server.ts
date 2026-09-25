import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { IProgress, IQuestionAttempt } from '$lib/users/records.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	bookmarks,
	mcqAttempts,
	quizAttempts,
	userProfiles,
	userProgress,
	userCourses
} from '$lib/server/neon/schema';

/** Persist only the user's selected courses instead of rewriting their full profile. */
export async function updateUserCourses(userId: string, courses: string[]): Promise<void> {
	const db = getNeonDatabase();
	const updateProfile = db
		.update(userProfiles)
		.set({ courses, updatedAt: new Date() })
		.where(eq(userProfiles.userId, userId));
	const deleteCourses = db.delete(userCourses).where(eq(userCourses.userId, userId));

	if (courses.length) {
		const insertCourses = db.insert(userCourses).values(
			courses.map((course, position) => ({
				userId,
				course,
				position
			}))
		);
		await db.batch([updateProfile, deleteCourses, insertCourses]);
		return;
	}

	await db.batch([updateProfile, deleteCourses]);
}

export interface IUserProfile {
	userId: string;
	courses: string[];
	progress: IProgress[];
	questionHistory: IQuestionAttempt[];
	bookmarkedQuestions: string[];
	createdAt: Date;
	updatedAt: Date;
}

type ProfileFilter = { userId?: string };

function whereFor(filter: ProfileFilter) {
	if (filter.userId) return eq(userProfiles.userId, filter.userId);
	return undefined;
}

export async function createUserProfile(userId: string): Promise<void> {
	await getNeonDatabase()
		.insert(userProfiles)
		.values({ userId })
		.onConflictDoNothing({ target: userProfiles.userId });
}

export async function getUserCourses(userId: string): Promise<string[]> {
	const rows = await getNeonDatabase()
		.select({ course: userCourses.course })
		.from(userCourses)
		.where(eq(userCourses.userId, userId))
		.orderBy(asc(userCourses.position));
	return rows.map((row) => row.course);
}

export async function getUserProgress(userId: string): Promise<IProgress[]> {
	const rows = await getNeonDatabase()
		.select()
		.from(userProgress)
		.where(eq(userProgress.userId, userId));
	return rows.map((row) => ({
		course: row.course,
		unit: row.unit,
		completed: row.completed,
		mastery: row.mastery,
		totalAttempts: row.totalAttempts,
		correctAttempts: row.correctAttempts,
		lastAttemptAt: row.lastAttemptAt ?? undefined,
		lastReviewedAt: row.lastReviewedAt ?? undefined
	}));
}

export type UserDashboardProfile = Pick<IUserProfile, 'courses' | 'progress' | 'createdAt'>;

/** Read the small profile base used by dashboard aggregate queries. */
export async function getUserDashboardProfile(
	userId: string
): Promise<UserDashboardProfile | null> {
	const db = getNeonDatabase();
	const [profiles, courses, progress] = await Promise.all([
		db
			.select({
				createdAt: userProfiles.createdAt
			})
			.from(userProfiles)
			.where(eq(userProfiles.userId, userId))
			.limit(1),
		getUserCourses(userId),
		getUserProgress(userId)
	]);
	const profile = profiles[0];
	if (!profile) return null;
	return { courses, progress, createdAt: profile.createdAt };
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
		db.delete(userCourses).where(inArray(userCourses.userId, userIds)),
		db.delete(userProgress).where(inArray(userProgress.userId, userIds)),
		db.delete(mcqAttempts).where(inArray(mcqAttempts.userId, userIds)),
		db.delete(quizAttempts).where(inArray(quizAttempts.userId, userIds)),
		db.delete(bookmarks).where(inArray(bookmarks.userId, userIds)),
		db.delete(userProfiles).where(inArray(userProfiles.userId, userIds))
	]);
}
