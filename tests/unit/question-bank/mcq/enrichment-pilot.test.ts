import { describe, expect, it } from 'vitest';
import {
	needsVisualContext,
	PILOT_VERSION,
	reusableStep,
	runPilotStep,
	selectPilotSample,
	sourceFingerprint,
	type PilotQuestion
} from '../../../../scripts/lib/mcq-enrichment-pilot';
const q = (questionId: string, unit: string, stimulusId?: string): PilotQuestion => ({
	questionId,
	data: { unit, stimulusId, question: 'test' }
});
describe('read-only enrichment pilot', () => {
	it('stratifies by unit and retains complete stimulus sets', () => {
		const questions = [q('a', '1', 'set'), q('b', '1', 'set'), q('c', '1'), q('d', '2')];
		expect(selectPilotSample(questions, ['1', '2'], 2).map((q) => q.questionId)).toEqual([
			'a',
			'b',
			'd'
		]);
	});
	it('invalidates checkpoints when source, model or version changes', () => {
		const question = q('a', '1');
		const record = {
			questionId: 'a',
			fingerprint: sourceFingerprint(question),
			classification: { status: 'proposed' as const, model: 'model', version: PILOT_VERSION }
		};
		expect(reusableStep(record, question, 'classification', 'model')).toBe(record.classification);
		expect(reusableStep(record, q('a', '2'), 'classification', 'model')).toBeUndefined();
		expect(reusableStep(record, question, 'classification', 'other')).toBeUndefined();
		expect(
			reusableStep(
				{ ...record, classification: { ...record.classification, version: 'old' } },
				question,
				'classification',
				'model'
			)
		).toBeUndefined();
	});
	it('bounds retries and preserves explicit review-needed output', async () => {
		let calls = 0;
		const failed = await runPilotStep('model', async () => {
			calls++;
			throw new Error('bad output');
		});
		expect(calls).toBe(3);
		expect(failed.status).toBe('failed');
		expect(
			(await runPilotStep('model', async () => ({ proposal: { reviewNeeded: true } }))).status
		).toBe('review-needed');
	});
	it('skips shared diagrams as well as question diagrams', () => {
		expect(
			needsVisualContext({ ...q('a', '1'), data: { stimulus: { diagramSpec: { type: 'plot' } } } })
		).toBe(true);
		expect(needsVisualContext(q('a', '1'))).toBe(false);
	});
});
