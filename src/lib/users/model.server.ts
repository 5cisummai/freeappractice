import { randomBytes } from 'node:crypto';
import { asc, desc, eq, inArray } from 'drizzle-orm';
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
	userProfiles,
	userProgress,
	userSubjects
} from '$lib/server/neon/schema';
import {
	applyProjection,
	PostgresQuery,
	type Projection,
	type WriteResult
} from '$lib/server/neon/model';

export function createReferralCode(): string {
	return randomBytes(9).toString('base64url');
}

export interface IUserProfile {
	_id: string;
	userId: string;
	referralCode?: string;
	subjects: string[];
	progress: IProgress[];
	questionHistory: IQuestionAttempt[];
	bookmarkedQuestions: string[];
	practiceExperiments?: IPracticeExperimentAssignment[];
	createdAt: Date;
	updatedAt: Date;
	save: () => Promise<IUserProfile>;
}

type ProfileFilter = { userId?: string; _id?: string; referralCode?: string };

function hasOwn(value: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(value, key);
}

async function loadProfile(userId: string): Promise<IUserProfile | null> {
	const db = getNeonDatabase() as any;
	const profile = (
		await db
			.select()
			.from(userProfiles as any)
			.where(eq((userProfiles as any).userId, userId))
			.limit(1)
	)[0] as any;
	if (!profile) return null;

	const [subjects, progress, attempts, savedBookmarks, experiments] = await Promise.all([
		db
			.select()
			.from(userSubjects as any)
			.where(eq((userSubjects as any).userId, userId))
			.orderBy(asc((userSubjects as any).position)),
		db
			.select()
			.from(userProgress as any)
			.where(eq((userProgress as any).userId, userId)),
		db
			.select()
			.from(mcqAttempts as any)
			.where(eq((mcqAttempts as any).userId, userId))
			.orderBy(desc((mcqAttempts as any).attemptedAt)),
		db
			.select()
			.from(bookmarks as any)
			.where(eq((bookmarks as any).userId, userId))
			.orderBy(asc((bookmarks as any).createdAt)),
		db
			.select()
			.from(experimentAssignments as any)
			.where(eq((experimentAssignments as any).userId, userId))
	]);

	const document: IUserProfile = {
		_id: userId,
		userId,
		referralCode: profile.referralCode ?? undefined,
		subjects: (subjects as Array<{ subject: string }>).map((row) => row.subject),
		progress: (progress as Array<Record<string, any>>).map((row) => ({
			apClass: row.apClass,
			unit: row.unit,
			completed: row.completed,
			mastery: row.mastery,
			totalAttempts: row.totalAttempts,
			correctAttempts: row.correctAttempts,
			lastAttemptAt: row.lastAttemptAt ?? undefined,
			lastReviewedAt: row.lastReviewedAt ?? undefined
		})),
		questionHistory: (attempts as Array<Record<string, any>>).map((row) => ({
			questionId: row.questionId,
			apClass: row.apClass,
			unit: row.unit,
			selectedAnswer: row.selectedAnswer ?? undefined,
			wasCorrect: row.wasCorrect ?? undefined,
			timeTakenMs: row.timeTakenMs ?? undefined,
			attemptedAt: row.attemptedAt,
			finalAnswer: row.finalAnswer ?? undefined,
			answerCount: row.answerCount ?? undefined,
			hintsShown: row.hintsShown ?? undefined,
			terminalOutcome: row.terminalOutcome ?? undefined,
			experimentKey: row.experimentKey ?? undefined,
			experimentVersion: row.experimentVersion ?? undefined,
			displayedVariant: row.displayedVariant ?? undefined
		})),
		bookmarkedQuestions: (savedBookmarks as Array<{ questionId: string }>).map(
			(row) => row.questionId
		),
		practiceExperiments: (experiments as Array<Record<string, any>>).map((row) => ({
			key: row.key,
			version: row.version,
			variant: row.variant
		})),
		createdAt: profile.createdAt,
		updatedAt: profile.updatedAt,
		save: async () => document
	};

	document.save = async () => {
		await saveProfile(document);
		return document;
	};
	return document;
}

async function saveProfile(profile: IUserProfile): Promise<void> {
	const db = getNeonDatabase() as any;
	await db
		.update(userProfiles as any)
		.set({
			referralCode: profile.referralCode ?? null,
			subjects: profile.subjects,
			updatedAt: new Date()
		})
		.where(eq((userProfiles as any).userId, profile.userId));

	await db.delete(userSubjects as any).where(eq((userSubjects as any).userId, profile.userId));
	if (profile.subjects.length) {
		await db
			.insert(userSubjects as any)
			.values(
				profile.subjects.map((subject, position) => ({ userId: profile.userId, subject, position }))
			);
	}

	await db.delete(userProgress as any).where(eq((userProgress as any).userId, profile.userId));
	if (profile.progress.length) {
		await db.insert(userProgress as any).values(
			profile.progress.map((entry) => ({
				userId: profile.userId,
				...entry,
				updatedAt: new Date()
			}))
		);
	}

	await db.delete(mcqAttempts as any).where(eq((mcqAttempts as any).userId, profile.userId));
	if (profile.questionHistory.length) {
		await db.insert(mcqAttempts as any).values(
			profile.questionHistory.map((attempt, index) => ({
				id: `${profile.userId}:legacy:${index}:${new Date(attempt.attemptedAt).getTime()}`,
				userId: profile.userId,
				...attempt,
				createdAt: new Date(attempt.attemptedAt)
			}))
		);
	}

	await db.delete(bookmarks as any).where(eq((bookmarks as any).userId, profile.userId));
	if (profile.bookmarkedQuestions.length) {
		await db
			.insert(bookmarks as any)
			.values(
				profile.bookmarkedQuestions.map((questionId) => ({ userId: profile.userId, questionId }))
			);
	}

	await db
		.delete(experimentAssignments as any)
		.where(eq((experimentAssignments as any).userId, profile.userId));
	if (profile.practiceExperiments?.length) {
		await db
			.insert(experimentAssignments as any)
			.values(
				profile.practiceExperiments.map((assignment) => ({ userId: profile.userId, ...assignment }))
			);
	}
}

function whereFor(filter: ProfileFilter): any {
	const db = getNeonDatabase() as any;
	void db;
	if (filter.userId || filter._id)
		return eq((userProfiles as any).userId, filter.userId ?? filter._id);
	if (filter.referralCode) return eq((userProfiles as any).referralCode, filter.referralCode);
	return undefined;
}

export const UserProfile = {
	findOne(filter: ProfileFilter = {}, projection?: Projection): PostgresQuery<IUserProfile | null> {
		return new PostgresQuery(async (options) => {
			const db = getNeonDatabase() as any;
			const rows = await db
				.select({ userId: (userProfiles as any).userId })
				.from(userProfiles as any)
				.where(whereFor(filter))
				.limit(1);
			const profile = rows[0]?.userId ? await loadProfile(rows[0].userId) : null;
			return profile ? applyProjection(profile, options.projection ?? projection) : null;
		});
	},
	find(filter: ProfileFilter = {}, projection?: Projection): PostgresQuery<IUserProfile[]> {
		return new PostgresQuery(async (options) => {
			const db = getNeonDatabase() as any;
			const rows = await db
				.select({ userId: (userProfiles as any).userId })
				.from(userProfiles as any)
				.where(whereFor(filter));
			const profiles = await Promise.all(
				(rows as Array<{ userId: string }>).map((row) => loadProfile(row.userId))
			);
			return profiles
				.filter((profile): profile is IUserProfile => Boolean(profile))
				.map((profile) => applyProjection(profile, options.projection ?? projection));
		});
	},
	async create(input: Partial<IUserProfile> & { userId: string }): Promise<IUserProfile> {
		const db = getNeonDatabase() as any;
		const profile: IUserProfile = {
			_id: input.userId,
			userId: input.userId,
			referralCode: input.referralCode ?? createReferralCode(),
			subjects: input.subjects ?? [],
			progress: input.progress ?? [],
			questionHistory: input.questionHistory ?? [],
			bookmarkedQuestions: input.bookmarkedQuestions ?? [],
			practiceExperiments: input.practiceExperiments ?? [],
			createdAt: input.createdAt ?? new Date(),
			updatedAt: input.updatedAt ?? new Date(),
			save: async () => profile
		};
		await db.insert(userProfiles as any).values({
			userId: profile.userId,
			referralCode: profile.referralCode,
			subjects: profile.subjects,
			createdAt: profile.createdAt,
			updatedAt: profile.updatedAt
		});
		await saveProfile(profile);
		return profile;
	},
	countDocuments(filter: ProfileFilter = {}): PostgresQuery<number> {
		return new PostgresQuery(async () => (await UserProfile.find(filter).exec()).length);
	},
	updateOne(filter: ProfileFilter, update: Record<string, any>): PostgresQuery<WriteResult> {
		return new PostgresQuery(async () => {
			const profile = await UserProfile.findOne(filter).exec();
			if (!profile)
				return {
					acknowledged: true,
					matchedCount: 0,
					modifiedCount: 0,
					deletedCount: 0,
					upsertedCount: 0
				};
			const set = update.$set ?? update;
			for (const [key, value] of Object.entries(set)) {
				if (hasOwn(profile as any, key)) (profile as any)[key] = value;
			}
			await profile.save();
			return {
				acknowledged: true,
				matchedCount: 1,
				modifiedCount: 1,
				deletedCount: 0,
				upsertedCount: 0
			};
		});
	},
	deleteMany(filter: { userId?: string | { $in: string[] } } = {}): PostgresQuery<WriteResult> {
		return new PostgresQuery(async () => {
			const ids =
				typeof filter.userId === 'object'
					? filter.userId.$in
					: filter.userId
						? [filter.userId]
						: (await UserProfile.find().exec()).map((p) => p.userId);
			if (!ids.length)
				return {
					acknowledged: true,
					matchedCount: 0,
					modifiedCount: 0,
					deletedCount: 0,
					upsertedCount: 0
				};
			const db = getNeonDatabase() as any;
			await Promise.all([
				db.delete(userSubjects as any).where(inArray((userSubjects as any).userId, ids)),
				db.delete(userProgress as any).where(inArray((userProgress as any).userId, ids)),
				db.delete(mcqAttempts as any).where(inArray((mcqAttempts as any).userId, ids)),
				db.delete(bookmarks as any).where(inArray((bookmarks as any).userId, ids)),
				db
					.delete(experimentAssignments as any)
					.where(inArray((experimentAssignments as any).userId, ids)),
				db.delete(userProfiles as any).where(inArray((userProfiles as any).userId, ids))
			]);
			return {
				acknowledged: true,
				matchedCount: ids.length,
				modifiedCount: 0,
				deletedCount: ids.length,
				upsertedCount: 0
			};
		});
	}
};
