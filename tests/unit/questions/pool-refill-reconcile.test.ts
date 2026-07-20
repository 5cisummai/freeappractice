import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findOneAndUpdate, updateOne, mcqCount, frqCount } = vi.hoisted(() => ({
	findOneAndUpdate: vi.fn(() => ({ exec: async () => ({}) })),
	updateOne: vi.fn(() => ({ exec: async () => ({}) })),
	mcqCount: vi.fn(),
	frqCount: vi.fn()
}));

vi.mock('$env/static/private', () => ({
	DATABASE_URI: 'mongodb://localhost/test',
	CRON_SECRET: 'test'
}));

vi.mock('$lib/server/db', () => ({
	connectDb: vi.fn(async () => ({}))
}));

vi.mock('$lib/questions/pool-refill-model.server', () => ({
	PoolRefillState: {
		findOneAndUpdate,
		updateOne
	}
}));

vi.mock('$lib/questions/cache-model.server', () => ({
	Question: { countDocuments: mcqCount }
}));

vi.mock('$lib/frq/model.server', () => ({
	FrqQuestionModel: { countDocuments: frqCount }
}));

vi.mock('$lib/catalog/ap-classes', () => ({
	getCourses: vi.fn(() => [{ name: 'AP Biology' }]),
	getUnitsForClass: vi.fn(() => ['Unit 1'])
}));

vi.mock('$lib/frq/profiles.server', () => ({
	getFrqCourseNames: vi.fn(() => ['AP Biology'])
}));

vi.mock('$lib/questions/gen-stats.server', () => ({
	getMcqGenerationCountsByClass: vi.fn(async () => ({
		'AP Biology': 100,
		'AP Chemistry': 40
	}))
}));

import { QUESTION_POOL_CONFIG, type QuestionPoolConfig } from '$lib/questions/pool-constants';
import {
	reconcilePoolRefillJobs,
	requestPoolRefill
} from '$lib/questions/pool-refill-queue.server';

function mockArgs(call: unknown): unknown[] {
	return Array.isArray(call) ? call : [];
}

describe('reconcilePoolRefillJobs target reconciliation', () => {
	beforeEach(() => {
		findOneAndUpdate.mockClear();
		updateOne.mockClear();
		mcqCount.mockReset();
		frqCount.mockReset();
		// MCQ below low-water for biology preferred 35 (8 < ceil(35*0.9)=32); FRQ at target 8
		mcqCount.mockResolvedValue(8);
		frqCount.mockResolvedValue(8);
	});

	it('enqueues buckets below low-water and marks full buckets idle', async () => {
		const env: QuestionPoolConfig = {
			...QUESTION_POOL_CONFIG,
			lowWaterRatio: 0.9
		};
		const result = await reconcilePoolRefillJobs(env);

		expect(result.reconciled).toBe(2);
		expect(result.enqueued).toBe(1);

		const mcqUpsert = findOneAndUpdate.mock.calls.find((call) => {
			const filter = mockArgs(call)[0] as { questionType?: string };
			return filter?.questionType === 'mcq';
		});
		expect(mockArgs(mcqUpsert)[1]).toMatchObject({
			$set: { target: 35, observedCount: 8 }
		});

		const frqUpsert = findOneAndUpdate.mock.calls.find((call) => {
			const filter = mockArgs(call)[0] as { questionType?: string };
			return filter?.questionType === 'frq';
		});
		expect(mockArgs(frqUpsert)[1]).toMatchObject({
			$set: { target: 8, observedCount: 8 }
		});

		// Full FRQ bucket should be forced idle when previously pending/failed
		expect(updateOne).toHaveBeenCalled();
		const idleCall = updateOne.mock.calls.find((call) => {
			const filter = mockArgs(call)[0] as { questionType?: string };
			return filter?.questionType === 'frq';
		});
		expect(mockArgs(idleCall)[1]).toMatchObject({
			$set: { status: 'idle' }
		});
	});
});

describe('requestPoolRefill', () => {
	beforeEach(() => {
		findOneAndUpdate.mockClear();
		updateOne.mockClear();
		mcqCount.mockResolvedValue(2);
	});

	it('upserts counts without stomping status, then promotes pending lease-safely', async () => {
		const env: QuestionPoolConfig = { ...QUESTION_POOL_CONFIG };
		await requestPoolRefill(
			{ questionType: 'mcq', apClass: 'AP Biology', unit: 'Unit 1' },
			env,
			{ 'AP Biology': 100 }
		);

		expect(findOneAndUpdate).toHaveBeenCalled();
		const upsert = mockArgs(findOneAndUpdate.mock.calls[0])[1] as {
			$set: { status?: string; target: number; observedCount: number };
			$setOnInsert: { status: string };
		};
		expect(upsert.$set.status).toBeUndefined();
		expect(upsert.$set.target).toBe(35);
		expect(upsert.$set.observedCount).toBe(2);
		expect(upsert.$setOnInsert.status).toBe('pending');

		expect(updateOne).toHaveBeenCalled();
		const promote = mockArgs(updateOne.mock.calls[0])[1] as {
			$set: { status: string; target: number; observedCount: number };
		};
		expect(promote.$set.status).toBe('pending');
		expect(promote.$set.target).toBe(35);
		expect(promote.$set.observedCount).toBe(2);
	});
});
