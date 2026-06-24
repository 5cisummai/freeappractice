import type { IQuestion } from '$lib/questions/cache-model.server';

export function buildSlimPoolDoc(opts: {
	s3QuestionId: string;
	apClass: string;
	unit: string;
	contentHash: string;
	topicsCovered: string;
}): Pick<
	IQuestion,
	| 's3QuestionId'
	| 'apClass'
	| 'unit'
	| 'contentHash'
	| 'topicsCovered'
	| 'lastServedAt'
	| 'status'
	| 'serveCount'
	| 'maxServeCount'
	| 'lockedUntil'
> {
	return {
		s3QuestionId: opts.s3QuestionId,
		apClass: opts.apClass,
		unit: opts.unit,
		contentHash: opts.contentHash,
		topicsCovered: opts.topicsCovered,
		lastServedAt: null,
		status: 'available',
		serveCount: 0,
		maxServeCount: 50,
		lockedUntil: null
	};
}
