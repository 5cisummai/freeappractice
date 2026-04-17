import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';
import { logger } from '$lib/server/logger';
import { normalizeUnit, findOrCreateProgressEntry } from '$lib/server/utils';

export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		const body = await event.request.json();
		const { apClass, unit, questionId, aiScore, pointsEarned, totalPoints, timeTakenMs } = body;
		const normalizedUnit = normalizeUnit(unit, 'all-units');

		if (!apClass || !questionId) {
			return json({ error: 'Missing required fields: apClass, questionId' }, { status: 400 });
		}
		if (typeof aiScore !== 'number' || aiScore < 0 || aiScore > 100) {
			return json({ error: 'aiScore must be a number between 0 and 100' }, { status: 400 });
		}
		if (typeof pointsEarned !== 'number' || typeof totalPoints !== 'number' || totalPoints < 1) {
			return json({ error: 'pointsEarned and totalPoints must be valid numbers' }, { status: 400 });
		}

		await connectDb();

		const user = await User.findById(userId);
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Record FRQ attempt
		user.frqHistory.push({
			questionId,
			apClass,
			unit: normalizedUnit,
			aiScore,
			pointsEarned,
			totalPoints,
			timeTakenMs: timeTakenMs ?? 0,
			attemptedAt: new Date()
		});

		// Update or create progress entry
		const progressEntry = findOrCreateProgressEntry(user.progress, apClass, normalizedUnit);

		progressEntry.frqTotalAttempts += 1;
		progressEntry.frqTotalScore += aiScore;
		progressEntry.lastAttemptAt = new Date();

		// const frqMastery = Math.round(progressEntry.frqTotalScore / progressEntry.frqTotalAttempts);

		await user.save();

		return json({
			message: 'FRQ attempt recorded successfully',
			questionId,
			// frqMastery,
			frqTotalAttempts: progressEntry.frqTotalAttempts
		});
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('Record FRQ attempt error', { error: err });
		return json({ error: 'Failed to record FRQ attempt' }, { status: 500 });
	}
};
