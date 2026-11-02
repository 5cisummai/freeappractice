import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { studyPlanToolInputSchema } from '#lib/agent/plans/tool-schema.js';
import { generativeCanvasToolInputSchema } from '#lib/canvas/schemas.js';
import { coachPracticeQuestionToolInputSchema } from '#lib/agent/tools/practice.js';
import { coachQuestionToolInputSchema } from '#lib/agent/tools/question.js';

type JsonSchemaNode = {
	type?: string;
	format?: string;
	pattern?: string;
	enum?: unknown[];
	description?: string;
	default?: unknown;
	properties?: Record<string, JsonSchemaNode>;
	items?: JsonSchemaNode;
	required?: string[];
	additionalProperties?: boolean;
	anyOf?: JsonSchemaNode[];
};

/** JSON Schema formats accepted by Vercel AI Gateway / OpenAI-style function calling. */
const STANDARD_JSON_SCHEMA_FORMATS = new Set([
	'date-time',
	'date',
	'time',
	'duration',
	'email',
	'idn-email',
	'hostname',
	'idn-hostname',
	'ipv4',
	'ipv6',
	'uri',
	'uri-reference',
	'iri',
	'iri-reference',
	'uuid',
	'uri-template',
	'json-pointer',
	'relative-json-pointer',
	'regex'
]);

function jsonSchemaForTool(schema: z.ZodType): JsonSchemaNode {
	return z.toJSONSchema(schema, { target: 'draft-7', io: 'input' }) as JsonSchemaNode;
}

function collectFormats(node: unknown, formats: string[] = []): string[] {
	if (!node || typeof node !== 'object') return formats;
	if (Array.isArray(node)) {
		for (const item of node) collectFormats(item, formats);
		return formats;
	}
	const record = node as Record<string, unknown>;
	if (typeof record.format === 'string') formats.push(record.format);
	for (const value of Object.values(record)) collectFormats(value, formats);
	return formats;
}

describe('study-plan tool schema', () => {
	it('fits strict function calling with explicit fields, descriptions, and nullable links', () => {
		const schema = jsonSchemaForTool(studyPlanToolInputSchema);
		const properties = schema.properties ?? {};
		const taskSchema = properties.tasks?.items;
		const taskProperties = taskSchema?.properties ?? {};
		const practiceHref = taskProperties.practiceHref;
		const practiceHrefString = practiceHref?.anyOf?.find((entry) => entry.type === 'string');

		expect(schema.additionalProperties).toBe(false);
		expect(schema.required).toEqual(['weekStart', 'behavior', 'tasks']);
		expect(properties.weekStart?.format).toBe('date');
		expect(properties.behavior?.enum).toEqual(['replace', 'merge']);
		expect(properties.behavior?.default).toBeUndefined();
		expect(taskSchema?.additionalProperties).toBe(false);
		expect(taskSchema?.required).toEqual([
			'id',
			'course',
			'unit',
			'mode',
			'dayOffset',
			'durationMinutes',
			'practiceHref'
		]);
		expect(taskProperties.mode?.description).toContain('mcq for multiple choice');
		expect(practiceHref?.anyOf?.some((entry) => entry.type === 'null')).toBe(true);
		expect(practiceHref?.description).toContain('or null when unavailable');
		expect(practiceHrefString?.format).toBeUndefined();
		expect(practiceHrefString?.pattern).toBe('^\\/app\\/practice');
		expect(
			collectFormats(schema).filter((format) => !STANDARD_JSON_SCHEMA_FORMATS.has(format))
		).toEqual([]);
	});

	it('accepts the app Government course and rejects malformed plan-mode inputs', () => {
		const validInput = {
			weekStart: '2026-09-21',
			behavior: 'replace',
			tasks: [
				{
					id: 'gov-unit-1',
					course: 'AP US Government',
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
				tasks: [
					{
						...validInput.tasks[0],
						practiceHref: '/app/practice?course=AP+US+Government&unit=Unit+1'
					}
				]
			}).success
		).toBe(true);
		expect(
			studyPlanToolInputSchema.safeParse({
				...validInput,
				tasks: [{ ...validInput.tasks[0], practiceHref: 'https://example.com' }]
			}).success
		).toBe(false);
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

describe('coach tool JSON schemas', () => {
	it.each([
		['update_study_plan', studyPlanToolInputSchema],
		['give_practice_question', coachPracticeQuestionToolInputSchema],
		['ask_student', coachQuestionToolInputSchema],
		['open_physics_sim', generativeCanvasToolInputSchema]
	] as const)('%s has no non-standard JSON Schema formats', (_name, schema) => {
		const formats = collectFormats(jsonSchemaForTool(schema));
		expect(formats.filter((format) => !STANDARD_JSON_SCHEMA_FORMATS.has(format))).toEqual([]);
	});
});
