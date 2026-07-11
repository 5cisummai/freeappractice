import { describe, expect, it } from 'vitest';
import {
	classifyQuestionFailure,
	daysBetweenCalendarDays,
	latencyBucket,
	localCalendarDay,
	questionSourceFromCachedFlag
} from '$lib/client/activation-funnel-metrics';

describe('latencyBucket', () => {
	it('maps durations to coarse buckets', () => {
		expect(latencyBucket(100)).toBe('0-500ms');
		expect(latencyBucket(750)).toBe('500-1000ms');
		expect(latencyBucket(1500)).toBe('1-2s');
		expect(latencyBucket(3000)).toBe('2-5s');
		expect(latencyBucket(9000)).toBe('5s+');
		expect(latencyBucket(Number.NaN)).toBe('5s+');
	});
});

describe('classifyQuestionFailure', () => {
	it('maps HTTP statuses to failure kinds', () => {
		expect(classifyQuestionFailure(null)).toBe('network');
		expect(classifyQuestionFailure(0)).toBe('network');
		expect(classifyQuestionFailure(400)).toBe('validation');
		expect(classifyQuestionFailure(403)).toBe('validation');
		expect(classifyQuestionFailure(422)).toBe('validation');
		expect(classifyQuestionFailure(429)).toBe('rate_limit');
		expect(classifyQuestionFailure(500)).toBe('generation');
		expect(classifyQuestionFailure(502)).toBe('generation');
	});
});

describe('questionSourceFromCachedFlag', () => {
	it('reads cached vs generated from API flag', () => {
		expect(questionSourceFromCachedFlag(true)).toBe('cached');
		expect(questionSourceFromCachedFlag(false)).toBe('generated');
		expect(questionSourceFromCachedFlag(undefined)).toBe('generated');
	});
});

describe('localCalendarDay', () => {
	it('formats YYYY-MM-DD in local time', () => {
		const day = localCalendarDay(new Date(2026, 6, 10, 15, 30));
		expect(day).toBe('2026-07-10');
	});
});

describe('daysBetweenCalendarDays', () => {
	it('counts whole calendar days between dates', () => {
		expect(daysBetweenCalendarDays('2026-07-09', '2026-07-10')).toBe(1);
		expect(daysBetweenCalendarDays('2026-07-10', '2026-07-10')).toBe(0);
		expect(daysBetweenCalendarDays('invalid', '2026-07-10')).toBe(0);
	});
});
