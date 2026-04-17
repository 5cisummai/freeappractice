/**
 * Shared server-side utilities.
 * Centralizes common patterns used across API routes and services.
 */

import { createHash } from 'node:crypto';
import crypto from 'crypto';
import { json } from '@sveltejs/kit';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { SeenQuestion } from '$lib/server/models/seen-question';
import type mongoose from 'mongoose';

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

// ── User lookup ────────────────────────────────────────────

/**
 * Connect to DB, find user by ID, and return the document.
 * Returns a 404 JSON Response if the user doesn't exist.
 */
export async function findUserOrFail(
	userId: string,
	select?: string
): Promise<mongoose.Document & { _id: mongoose.Types.ObjectId }> {
	await connectDb();
	const query = User.findById(userId);
	if (select) query.select(select);
	const user = await query;
	if (!user) {
		throw json({ error: 'User not found' }, { status: 404 });
	}
	return user;
}

// ── Email token generation ─────────────────────────────────

/** Generate a random hex token (default 32 bytes = 64 hex chars). */
export function generateRandomToken(length = 32): string {
	return crypto.randomBytes(length).toString('hex');
}

/** Generate a verification/reset token and its 24-hour expiration date. */
export function generateEmailToken(): { emailToken: string; emailTokenExpires: Date } {
	return {
		emailToken: generateRandomToken(),
		emailTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
	};
}

// ── Streak calculation ─────────────────────────────────────

/** Calculate current daily streak from a list of attempts with `attemptedAt` dates. */
export function calcStreak(history: Array<{ attemptedAt: Date }>): number {
	if (!history.length) return 0;

	const sortedDates = [...new Set(history.map((q) => new Date(q.attemptedAt).toDateString()))].sort(
		(a, b) => new Date(b).getTime() - new Date(a).getTime()
	);

	const today = new Date().toDateString();
	const yesterday = new Date(Date.now() - 86400000).toDateString();

	if (!sortedDates.includes(today) && !sortedDates.includes(yesterday)) return 0;

	let streak = 1;
	for (let i = 1; i < sortedDates.length; i++) {
		const dayDiff = Math.floor(
			(new Date(sortedDates[i - 1]).getTime() - new Date(sortedDates[i]).getTime()) / 86400000
		);
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
	frqTotalAttempts: number;
	frqTotalScore: number;
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
			correctAttempts: 0,
			frqTotalAttempts: 0,
			frqTotalScore: 0
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
	questionType: 'mcq' | 'frq'
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

// ── Password validation ────────────────────────────────────

export const MIN_PASSWORD_LENGTH = 8;
