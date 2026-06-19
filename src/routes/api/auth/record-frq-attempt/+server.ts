import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/server/route-helpers';
import { findOrCreateProgressEntry, findUserOrFail, normalizeUnit } from '$lib/server/utils';

export const POST = withAuthedHandler(
	async (event, userId) => {
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

		const user = await findUserOrFail(userId);

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

		const progressEntry = findOrCreateProgressEntry(user.progress, apClass, normalizedUnit);

		progressEntry.frqTotalAttempts += 1;
		progressEntry.frqTotalScore += aiScore;
		progressEntry.lastAttemptAt = new Date();

		await user.save();

		return json({
			message: 'FRQ attempt recorded successfully',
			questionId,
			frqTotalAttempts: progressEntry.frqTotalAttempts
		});
	},
	{ logLabel: 'Record FRQ attempt error', errorMessage: 'Failed to record FRQ attempt' }
);
