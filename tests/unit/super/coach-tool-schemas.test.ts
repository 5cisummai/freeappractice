import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { studyPlanToolInputSchema } from '$lib/super/coach-tool-schemas';

type JsonSchemaNode = {
	type?: string;
	format?: string;
	enum?: unknown[];
	description?: string;
	default?: unknown;
	properties?: Record<string, JsonSchemaNode>;
	items?: JsonSchemaNode;
	required?: string[];
	additionalProperties?: boolean;
	anyOf?: JsonSchemaNode[];
};

describe('study-plan tool schema', () => {
	it('fits strict function calling with explicit fields, descriptions, and nullable links', () => {
		const schema = z.toJSONSchema(studyPlanToolInputSchema) as JsonSchemaNode;
		const properties = schema.properties ?? {};
		const taskSchema = properties.tasks?.items;
		const taskProperties = taskSchema?.properties ?? {};

		expect(schema.additionalProperties).toBe(false);
		expect(schema.required).toEqual(['weekStart', 'behavior', 'tasks']);
		expect(properties.weekStart?.format).toBe('date');
		expect(properties.behavior?.enum).toEqual(['replace', 'merge']);
		expect(properties.behavior?.default).toBeUndefined();
		expect(taskSchema?.additionalProperties).toBe(false);
		expect(taskSchema?.required).toEqual([
			'id',
			'apClass',
			'unit',
			'mode',
			'dayOffset',
			'durationMinutes',
			'practiceHref'
		]);
		expect(taskProperties.mode?.description).toContain('mcq for multiple choice');
		expect(taskProperties.practiceHref?.anyOf?.some((schema) => schema.type === 'null')).toBe(true);
		expect(taskProperties.practiceHref?.description).toContain('or null when unavailable');
	});

	it('accepts the Government alias and rejects malformed plan-mode inputs', () => {
		const validInput = {
			weekStart: '2026-09-21',
			behavior: 'replace',
			tasks: [
				{
					id: 'gov-unit-1',
					apClass: 'AP U.S. Government and Politics',
					unit: 'Unit 1: Foundations of American Democracy',
					mode: 'mcq',
					dayOffset: 0,
					durationMinutes: 20,
					practiceHref: null
				}
			]
		};

		expect(studyPlanToolInputSchema.safeParse(validInput).success).toBe(true);
		expect(
			studyPlanToolInputSchema.safeParse({
				...validInput,
				tasks: [{ ...validInput.tasks[0], practiceHref: undefined }]
			}).success
		).toBe(false);
		expect(
			studyPlanToolInputSchema.safeParse({ ...validInput, extra: 'not allowed' }).success
		).toBe(false);
	});
});
