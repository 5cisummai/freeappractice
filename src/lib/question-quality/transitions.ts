import type { QualityState, ReviewJobStatus } from './types.js';

export type ReviewItemStatus =
	'queued' | 'preparing' | 'submitted' | 'awaiting_human' | 'final' | 'failed';

export type ReviewJobTransition =
	'activate' | 'start' | 'pause' | 'resume' | 'await_human' | 'complete' | 'cancel';

export type ReviewItemTransition =
	'prepare' | 'submit' | 'retry' | 'await_human' | 'finalize' | 'fail';

export type QualityStateTransition = 'assess_for_human' | 'finalize';

const JOB_TRANSITIONS: Record<
	ReviewJobStatus,
	Partial<Record<ReviewJobTransition, ReviewJobStatus>>
> = {
	preview: { activate: 'preparing' },
	preparing: { start: 'in_progress', pause: 'paused', complete: 'completed', cancel: 'cancelled' },
	in_progress: {
		pause: 'paused',
		await_human: 'awaiting_human',
		complete: 'completed',
		cancel: 'cancelled'
	},
	paused: { resume: 'preparing', cancel: 'cancelled' },
	awaiting_human: { complete: 'completed', cancel: 'cancelled' },
	completed: {},
	cancelled: {},
	failed: {}
};

const ITEM_TRANSITIONS: Record<
	ReviewItemStatus,
	Partial<Record<ReviewItemTransition, ReviewItemStatus>>
> = {
	queued: { prepare: 'preparing', fail: 'failed' },
	preparing: { submit: 'submitted', retry: 'queued', fail: 'failed' },
	submitted: { retry: 'queued', await_human: 'awaiting_human', finalize: 'final', fail: 'failed' },
	awaiting_human: { finalize: 'final' },
	final: {},
	failed: {}
};

const QUALITY_STATE_TRANSITIONS: Record<
	QualityState,
	Partial<Record<QualityStateTransition, QualityState>>
> = {
	unreviewed: { assess_for_human: 'awaiting_human', finalize: 'final' },
	awaiting_human: { finalize: 'final' },
	final: {}
};

export class InvalidQualityTransitionError extends Error {
	constructor(entity: string, from: string, transition: string) {
		super(`Invalid question-quality ${entity} transition: ${from} -> ${transition}`);
		this.name = 'InvalidQualityTransitionError';
	}
}

export function transitionReviewJobStatus(
	current: ReviewJobStatus,
	transition: ReviewJobTransition
): ReviewJobStatus {
	const next = JOB_TRANSITIONS[current]?.[transition];
	if (!next) throw new InvalidQualityTransitionError('job', current, transition);
	return next;
}

export function transitionReviewItemStatus(
	current: ReviewItemStatus,
	transition: ReviewItemTransition
): ReviewItemStatus {
	const next = ITEM_TRANSITIONS[current]?.[transition];
	if (!next) throw new InvalidQualityTransitionError('item', current, transition);
	return next;
}

export function transitionQualityState(
	current: QualityState,
	transition: QualityStateTransition
): QualityState {
	const next = QUALITY_STATE_TRANSITIONS[current]?.[transition];
	if (!next) throw new InvalidQualityTransitionError('quality record', current, transition);
	return next;
}

export function reviewJobStatusFor(
	transition: ReviewJobTransition,
	from: ReviewJobStatus[]
): ReviewJobStatus {
	const next = from.map((status) => transitionReviewJobStatus(status, transition));
	const first = next[0];
	if (!first || next.some((status) => status !== first)) {
		throw new InvalidQualityTransitionError('job', from.join(','), transition);
	}
	return first;
}
