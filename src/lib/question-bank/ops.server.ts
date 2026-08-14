import {
	enqueueAllCatalogDeficits,
	reconcilePoolRefillJobs,
	requestPoolRefill,
	type PoolBucketKey
} from '$lib/question-bank/pool-refill-queue.server';
import {
	runQuestionPoolRefillWorker,
	type RefillRunSummary
} from '$lib/question-bank/pool-refill.server';
import {
	getQuestionInventory,
	type QuestionInventoryAdapter,
	type QuestionInventoryKind
} from '$lib/question-bank/inventory.server';
import { QUESTION_POOL_CONFIG, type QuestionPoolConfig } from '$lib/question-bank/pool-constants';

type RefillParams =
	| { mode: 'request'; bucket: PoolBucketKey; config?: QuestionPoolConfig }
	| { mode: 'reconcile'; config?: QuestionPoolConfig }
	| { mode: 'enqueue'; config?: QuestionPoolConfig }
	| {
			mode: 'run';
			config?: QuestionPoolConfig;
			options?: Parameters<typeof runQuestionPoolRefillWorker>[1];
	  };

/**
 * Worker/ops interface for the Question Bank feature.
 * Serving callers use `questionBank.get`; only scripts and cron import this
 * module, which keeps generation and inventory off the request path.
 */

export class QuestionBankOperations {
	async refill(
		params: RefillParams
	): Promise<void | { reconciled: number; enqueued: number } | number | RefillRunSummary> {
		switch (params.mode) {
			case 'request':
				return requestPoolRefill(params.bucket, params.config ?? QUESTION_POOL_CONFIG);
			case 'reconcile':
				return reconcilePoolRefillJobs(params.config ?? QUESTION_POOL_CONFIG);
			case 'enqueue':
				return enqueueAllCatalogDeficits(params.config ?? QUESTION_POOL_CONFIG);
			case 'run':
				return runQuestionPoolRefillWorker(params.config ?? QUESTION_POOL_CONFIG, params.options);
		}
	}

	inventory(kind: QuestionInventoryKind): QuestionInventoryAdapter {
		return getQuestionInventory(kind);
	}
}

export const questionBankOps = new QuestionBankOperations();

/** Compatibility-free function for cron and scripts that need one operation. */
export const refill = questionBankOps.refill.bind(questionBankOps);
