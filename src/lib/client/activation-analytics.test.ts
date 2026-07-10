import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	classifyQuestionFailure,
	daysBetweenCalendarDays,
	latencyBucket,
	localCalendarDay,
	questionSourceFromCachedFlag
} from './activation-funnel-metrics.js';

describe('latencyBucket', () => {
	it('maps durations to coarse buckets', () => {
		assert.equal(latencyBucket(100), '0-500ms');
		assert.equal(latencyBucket(750), '500-1000ms');
		assert.equal(latencyBucket(1500), '1-2s');
		assert.equal(latencyBucket(3000), '2-5s');
		assert.equal(latencyBucket(9000), '5s+');
		assert.equal(latencyBucket(Number.NaN), '5s+');
	});
});

describe('classifyQuestionFailure', () => {
	it('maps HTTP statuses to failure kinds', () => {
		assert.equal(classifyQuestionFailure(null), 'network');
		assert.equal(classifyQuestionFailure(0), 'network');
		assert.equal(classifyQuestionFailure(400), 'validation');
		assert.equal(classifyQuestionFailure(403), 'validation');
		assert.equal(classifyQuestionFailure(422), 'validation');
		assert.equal(classifyQuestionFailure(429), 'rate_limit');
		assert.equal(classifyQuestionFailure(500), 'generation');
		assert.equal(classifyQuestionFailure(502), 'generation');
	});
});

describe('questionSourceFromCachedFlag', () => {
	it('reads cached vs generated from API flag', () => {
		assert.equal(questionSourceFromCachedFlag(true), 'cached');
		assert.equal(questionSourceFromCachedFlag(false), 'generated');
		assert.equal(questionSourceFromCachedFlag(undefined), 'generated');
	});
});

describe('localCalendarDay', () => {
	it('formats YYYY-MM-DD in local time', () => {
		const day = localCalendarDay(new Date(2026, 6, 10, 15, 30));
		assert.equal(day, '2026-07-10');
	});
});

describe('daysBetweenCalendarDays', () => {
	it('counts whole calendar days between dates', () => {
		assert.equal(daysBetweenCalendarDays('2026-07-09', '2026-07-10'), 1);
		assert.equal(daysBetweenCalendarDays('2026-07-10', '2026-07-10'), 0);
		assert.equal(daysBetweenCalendarDays('invalid', '2026-07-10'), 0);
	});
});
