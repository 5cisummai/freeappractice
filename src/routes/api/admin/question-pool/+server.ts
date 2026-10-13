import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAdminUser } from '#lib/auth/admin.server.js';
import {
	cancelPoolBucketRefill,
	enqueueAllPoolDeficits,
	enqueuePoolBucketRefill,
	getPoolReadinessSnapshot,
	retireOldestPoolPercent,
	retirePoolBucketQuestions
} from '#lib/admin/dashboard.server.js';
import { InvalidPoolBucketError } from '#lib/question-bank/pool-refill-queue.server.js';
import { POOL_RETIRE_OLDEST_PERCENT } from '#lib/question-bank/pool-constants.js';
import type { PoolQuestionType } from '#lib/admin/types.js';

function requireAdmin(event: Parameters<RequestHandler>[0]): string {
	if (!isAdminUser(event.locals.user)) {
		throw error(403, 'Admin access required');
	}
	return event.locals.user!.id;
}

function isPoolQuestionType(value: unknown): value is PoolQuestionType {
	return value === 'mcq' || value === 'frq';
}

export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	return Response.json(await getPoolReadinessSnapshot());
};

export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const body = (await event.request.json()) as {
		action?: string;
		questionType?: string;
		course?: string;
		unit?: string;
		quantity?: number;
		percent?: number;
	};

	switch (body.action) {
		case 'enqueueBucket': {
			if (!isPoolQuestionType(body.questionType)) {
				return Response.json({ message: 'questionType must be mcq or frq' }, { status: 400 });
			}
			const course = body.course?.trim() ?? '';
			const unit = body.unit?.trim() ?? '';
			if (!course || !unit) {
				return Response.json({ message: 'course and unit are required' }, { status: 400 });
			}
			try {
				await enqueuePoolBucketRefill({
					questionType: body.questionType,
					course,
					unit
				});
			} catch (error) {
				if (error instanceof InvalidPoolBucketError) {
					return Response.json({ message: error.message }, { status: 400 });
				}
				throw error;
			}
			return Response.json({ ok: true, enqueued: 1 }, { status: 202 });
		}
		case 'cancelRefill': {
			if (!isPoolQuestionType(body.questionType)) {
				return Response.json({ message: 'questionType must be mcq or frq' }, { status: 400 });
			}
			const course = body.course?.trim() ?? '';
			const unit = body.unit?.trim() ?? '';
			if (!course || !unit) {
				return Response.json({ message: 'course and unit are required' }, { status: 400 });
			}
			const result = await cancelPoolBucketRefill({
				questionType: body.questionType,
				course,
				unit
			});
			return Response.json({ ok: true, ...result });
		}
		case 'enqueueAllDeficits': {
			const result = await enqueueAllPoolDeficits();
			return Response.json({ ok: true, ...result }, { status: 202 });
		}
		case 'retireBucket': {
			if (!isPoolQuestionType(body.questionType)) {
				return Response.json({ message: 'questionType must be mcq or frq' }, { status: 400 });
			}
			const course = body.course?.trim() ?? '';
			const unit = body.unit?.trim() ?? '';
			const quantity = body.quantity;
			if (!course || !unit) {
				return Response.json({ message: 'course and unit are required' }, { status: 400 });
			}
			if (
				typeof quantity !== 'number' ||
				!Number.isInteger(quantity) ||
				quantity < 1 ||
				quantity > 10000
			) {
				return Response.json(
					{ message: 'quantity must be a whole number between 1 and 10,000' },
					{ status: 400 }
				);
			}
			const result = await retirePoolBucketQuestions(
				{ questionType: body.questionType, course, unit },
				quantity
			);
			return Response.json({ ok: true, ...result }, { status: 202 });
		}
		case 'retireOldestPercent': {
			const percent =
				typeof body.percent === 'number' && Number.isFinite(body.percent)
					? body.percent
					: POOL_RETIRE_OLDEST_PERCENT;
			if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
				return Response.json(
					{ message: 'percent must be a whole number between 1 and 100' },
					{ status: 400 }
				);
			}
			const result = await retireOldestPoolPercent(percent);
			return Response.json({ ok: true, ...result }, { status: 202 });
		}
		case 'refresh':
			return Response.json(await getPoolReadinessSnapshot());
		default:
			return Response.json({ message: 'Unknown action' }, { status: 400 });
	}
};
