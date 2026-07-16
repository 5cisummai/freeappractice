import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/private', () => ({
	OPEN_AI_KEY: 'test-key'
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		ADVANCED_MODEL: 'advanced-model',
		BASIC_MODEL: 'basic-model',
		TUTOR_MODEL: 'tutor-model'
	}
}));

import { selectModelForClass } from '$lib/ai/service.server';

describe('selectModelForClass', () => {
	it('routes humanities-style classes to the basic model', () => {
		expect(selectModelForClass('AP US History')).toBe('basic-model');
		expect(selectModelForClass('AP Psychology')).toBe('basic-model');
		expect(selectModelForClass('AP English Literature')).toBe('basic-model');
		expect(selectModelForClass('AP Computer Science Principles')).toBe('basic-model');
	});

	it('routes STEM classes to the advanced model', () => {
		expect(selectModelForClass('AP Biology')).toBe('advanced-model');
		expect(selectModelForClass('AP Calculus AB')).toBe('advanced-model');
		expect(selectModelForClass('AP Computer Science A')).toBe('advanced-model');
	});
});
