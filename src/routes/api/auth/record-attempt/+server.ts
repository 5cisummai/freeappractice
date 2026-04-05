import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';
import { logger } from '$lib/server/logger';

function normalizeUnit(unit: unknown): string {
	return typeof unit === 'string' && unit.trim() ? unit.trim() : 'all-units';
}

export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		const body = await event.request.json();
		const { apClass, unit, questionId, selectedAnswer, wasCorrect, timeTakenMs } = body;
		const normalizedUnit = normalizeUnit(unit);

		if (!apClass || !questionId || !selectedAnswer || typeof wasCorrect !== 'boolean') {
			return json(
				{ error: 'Missing required fields: apClass, questionId, selectedAnswer, wasCorrect' },
				{ status: 400 }
			);
		}

		await connectDb();

		const user = await User.findById(userId);
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Record attempt in history
		user.questionHistory.push({
			questionId,
			apClass,
			unit: normalizedUnit,
			selectedAnswer,
			wasCorrect,
			timeTakenMs: timeTakenMs ?? 0,
			attemptedAt: new Date()
		});

		// Update or create progress entry
		let progressEntry = user.progress.find(
			(p) => p.apClass === apClass && p.unit === normalizedUnit
		);

		if (!progressEntry) {
			user.progress.push({
				apClass,
				unit: normalizedUnit,
				completed: false,
				mastery: 0,
				totalAttempts: 0,
				correctAttempts: 0,
				frqTotalAttempts: 0,
				frqTotalScore: 0
			});
			progressEntry = user.progress[user.progress.length - 1];
		}

		progressEntry.totalAttempts++;
		if (wasCorrect) progressEntry.correctAttempts++;
		progressEntry.mastery = Math.round(
			(progressEntry.correctAttempts / progressEntry.totalAttempts) * 100
		);
		progressEntry.lastAttemptAt = new Date();

		await user.save();

		return json({
			message: 'Attempt recorded successfully',
			questionId,
			mastery: progressEntry.mastery,
			totalAttempts: progressEntry.totalAttempts
		});
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('Record attempt error', { error: err });
		return json({ error: 'Failed to record attempt' }, { status: 500 });
	}
};
