/**
 * Shared server-side utilities.
 * Centralizes common patterns used across API routes and services.
 */

import { createHash } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { SeenQuestion } from '$lib/server/models/seen-question';
import { UserProfile } from '$lib/server/models/user-profile';
import type { IUserProfile } from '$lib/server/models/user-profile';
import { ensureUserProfile } from '$lib/server/user-profile';

// ── Duplicate-key detection ────────────────────────────────

/** Check if an error is a MongoDB duplicate-key error (E11000). */
export function isDuplicateKeyError(err: unknown): boolean {
	return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

// ── Content hashing ────────────────────────────────────────

/** Normalize and hash text for deduplication (SHA-256). */
export function computeContentHash(text: string): string {
	return createHash('sha256').update(text.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');
}

// ── Unit normalization ─────────────────────────────────────

/**
 * Normalize a unit string for cache/pool operations.
 * Returns a trimmed string, falling back to `fallback` when empty.
 */
export function normalizeUnit(unit?: string | null, fallback = ''): string {
	const trimmed = typeof unit === 'string' ? unit.trim() : '';
	return trimmed || fallback;
}

// ── User profile lookup ─────────────────────────────────────

export async function findUserProfileOrFail(
	userId: string,
	select?: string
): Promise<IUserProfile> {
	await ensureUserProfile(userId);
	const query = UserProfile.findOne({ userId });
	if (select) query.select(select);
	const profile = await query;
	if (!profile) {
		throw json({ error: 'User profile not found' }, { status: 404 });
	}
	return profile;
}

// ── Streak calculation ─────────────────────────────────────

/** Calculate current daily streak from a list of attempts with `attemptedAt` dates. */
export function calcStreak(history: Array<{ attemptedAt: Date }>): number {
	if (!history.length) return 0;

	const toUtcDayKey = (date: Date) => date.toISOString().slice(0, 10);

	const sortedDates = [...new Set(history.map((q) => toUtcDayKey(new Date(q.attemptedAt))))].sort(
		(a, b) => b.localeCompare(a)
	);

	const today = toUtcDayKey(new Date());
	const yesterday = toUtcDayKey(new Date(Date.now() - 86_400_000));

	if (!sortedDates.includes(today) && !sortedDates.includes(yesterday)) return 0;

	let streak = 1;
	for (let i = 1; i < sortedDates.length; i++) {
		const previous = new Date(`${sortedDates[i - 1]}T00:00:00.000Z`);
		const current = new Date(`${sortedDates[i]}T00:00:00.000Z`);
		const dayDiff = Math.round((previous.getTime() - current.getTime()) / 86_400_000);
		if (dayDiff === 1) streak++;
		else break;
	}
	return streak;
}

// ── Progress entry management ──────────────────────────────

interface ProgressEntry {
	apClass: string;
	unit: string;
	completed: boolean;
	mastery: number;
	totalAttempts: number;
	correctAttempts: number;
	lastAttemptAt?: Date;
}

/**
 * Find or create a progress entry for the given class+unit on a user document.
 * Mutates the user's progress array if a new entry is created.
 */
export function findOrCreateProgressEntry(
	progress: ProgressEntry[],
	apClass: string,
	unit: string
): ProgressEntry {
	let entry = progress.find((p) => p.apClass === apClass && p.unit === unit);
	if (!entry) {
		progress.push({
			apClass,
			unit,
			completed: false,
			mastery: 0,
			totalAttempts: 0,
			correctAttempts: 0
		});
		entry = progress[progress.length - 1];
	}
	return entry;
}

// ── Seen-question tracking ─────────────────────────────────

const MAX_SEEN_PER_BUCKET = 100;

/**
 * Record that a user has seen a question (fire-and-forget).
 * Prunes the oldest entries if the bucket exceeds MAX_SEEN_PER_BUCKET.
 */
export async function recordSeenQuestion(
	userId: string,
	contentHash: string,
	apClass: string,
	unit: string,
	questionType: 'mcq'
): Promise<void> {
	try {
		await SeenQuestion.updateOne(
			{ userId, contentHash },
			{ $setOnInsert: { userId, contentHash, apClass, unit, questionType } },
			{ upsert: true }
		);

		const count = await SeenQuestion.countDocuments({ userId, apClass, unit, questionType });
		if (count > MAX_SEEN_PER_BUCKET) {
			const excess = count - MAX_SEEN_PER_BUCKET;
			const oldest = await SeenQuestion.find(
				{ userId, apClass, unit, questionType },
				{ _id: 1 },
				{ sort: { seenAt: 1 }, limit: excess }
			).lean();
			await SeenQuestion.deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
		}
	} catch {
		// Non-critical — don't let history tracking affect the main request
	}
}
