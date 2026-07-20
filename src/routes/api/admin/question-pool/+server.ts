import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAdminUser } from '$lib/auth/admin.server';
import {
	enqueueAllPoolDeficits,
	enqueuePoolBucketRefill,
	getPoolReadinessSnapshot
} from '$lib/admin/dashboard.server';
import type { PoolQuestionType } from '$lib/admin/types';

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
	return json(await getPoolReadinessSnapshot());
};

export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const body = (await event.request.json()) as {
		action?: string;
		questionType?: string;
		apClass?: string;
		unit?: string;
	};

	switch (body.action) {
		case 'enqueueBucket': {
			if (!isPoolQuestionType(body.questionType)) {
				return json({ message: 'questionType must be mcq or frq' }, { status: 400 });
			}
			const apClass = body.apClass?.trim() ?? '';
			const unit = body.unit?.trim() ?? '';
			if (!apClass || !unit) {
				return json({ message: 'apClass and unit are required' }, { status: 400 });
			}
			await enqueuePoolBucketRefill({
				questionType: body.questionType,
				apClass,
				unit
			});
			return json({ ok: true, enqueued: 1 }, { status: 202 });
		}
		case 'enqueueAllDeficits': {
			const result = await enqueueAllPoolDeficits();
			return json({ ok: true, ...result }, { status: 202 });
		}
		case 'refresh':
			return json(await getPoolReadinessSnapshot());
		default:
			return json({ message: 'Unknown action' }, { status: 400 });
	}
};
