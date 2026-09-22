import { describe, expect, it } from 'vitest';
import { getUnitsForClass } from '$lib/catalog/ap-classes';
import { AP_DATA } from '$lib/data/ap-data';
import {
	buildFrqGenerationPrompt,
	parseGeneratedFrq
} from '$lib/question-bank/frq/generation.server';
import {
	FRQ_SCOPE_SENTENCE,
	frqPracticeFor,
	resolveFrqPoolRequest
} from '$lib/question-bank/frq/practice';
import {
	frqFormatWire,
	getFrqCourseNames,
	getFrqFormat,
	type FrqFormatRecord
} from '$lib/question-bank/frq/profiles.server';
import { frqResponseIds, frqTotalPoints, toPublicFrqQuestion } from '$lib/question-bank/frq/types';

const COURSES = [
	'AP Human Geography',
	'AP English Language',
	'AP World History',
	'AP Biology',
	'AP Chemistry'
] as const;

function examFormatIds(courseName: string): string[] {
	const course = AP_DATA.courses.find((item) => item.name === courseName);
	if (!course) throw new Error(`Missing course ${courseName}`);
	return course.official.exam.sections.flatMap((section) =>
		section.id !== 'multiple-choice' && 'questionTypes' in section ? section.questionTypes : []
	);
}

function generatedFor(format: FrqFormatRecord): {
	prompt: string;
	materials: { id: string; title: string; content: string }[];
	parts: {
		id: string;
		label: string;
		prompt: string;
		earns: string;
		answer: string;
		points: number | null;
	}[];
	mainTopic: string;
	topicsCovered: string;
} {
	const materialCount = format.materialMin;
	return {
		prompt: `Original ${format.formatId} task.`,
		materials: Array.from({ length: materialCount }, (_, index) => ({
			id: `material-${index + 1}`,
			title: `Material ${index + 1}`,
			content: `Original material ${index + 1}.`
		})),
		parts: format.parts
			? format.parts.map((part) => ({
					id: part.id,
					label: 'ignored when the format fixes the label',
					prompt: part.prompt ?? `Student task ${part.id}.`,
					earns:
						part.earns ??
						(part.points === 1
							? `Award 1 for a complete ${part.id} response.`
							: Array.from(
									{ length: part.points },
									(_, index) => `Award point ${index + 1} for check ${index + 1}.`
								).join(' ')),
					answer: `Acceptable response for ${part.id}.`,
					points: null
				}))
			: Array.from({ length: format.pointTotal }, (_, index) => ({
					id: String.fromCharCode(65 + index),
					label: String.fromCharCode(65 + index),
					prompt: `Calculate step ${index + 1}.`,
					earns: 'Award 1 for the value with units.',
					answer: '1.0 g',
					points: 1
				})),
		mainTopic: 'Unit topic',
		topicsCovered: 'Unit topic'
	};
}

describe('FRQ format records', () => {
	it('covers the five courses and their official format ids', () => {
		expect(getFrqCourseNames().sort()).toEqual([...COURSES].sort());
		for (const courseName of COURSES) {
			const official = examFormatIds(courseName).sort();
			const course = AP_DATA.courses.find((item) => item.name === courseName);
			const wired = course?.generation.frq;
			if (!wired || !('formats' in wired))
				throw new Error(`${courseName} generation.frq is not wired`);
			const formats = official.map((formatId) => {
				const format = getFrqFormat(courseName, formatId);
				if (!format) throw new Error(`Missing format ${courseName} ${formatId}`);
				return format;
			});
			expect(formats.map((format) => format.formatId).sort()).toEqual(official);
			expect(wired.formats).toEqual(formats.map(frqFormatWire));
		}
	});

	it('fixes English at 1/4/1 on one essay', () => {
		for (const formatId of ['synthesis', 'rhetorical-analysis', 'argument']) {
			const format = getFrqFormat('AP English Language', formatId);
			expect(format?.responseMode).toBe('essay');
			expect(format?.parts?.map((part) => part.points)).toEqual([1, 4, 1]);
			expect(format?.parts?.map((part) => part.id)).toEqual([
				'thesis',
				'evidence-commentary',
				'sophistication'
			]);
		}
		expect(getFrqFormat('AP English Language', 'synthesis')?.materialMax).toBe(6);
		expect(getFrqFormat('AP English Language', 'rhetorical-analysis')?.materialMax).toBe(1);
		expect(getFrqFormat('AP English Language', 'argument')?.materialMax).toBe(0);
	});

	it('gives Human Geography seven 1-point parts', () => {
		for (const formatId of [
			'no-stimulus-scenario',
			'one-stimulus-scenario',
			'two-stimulus-scenario'
		]) {
			const format = getFrqFormat('AP Human Geography', formatId);
			expect(format?.responseMode).toBe('parts');
			expect(format?.parts?.map((part) => part.points)).toEqual([1, 1, 1, 1, 1, 1, 1]);
		}
		expect(getFrqFormat('AP Human Geography', 'no-stimulus-scenario')?.materialMax).toBe(0);
		expect(getFrqFormat('AP Human Geography', 'one-stimulus-scenario')?.materialMax).toBe(1);
		expect(getFrqFormat('AP Human Geography', 'two-stimulus-scenario')?.materialMax).toBe(2);
	});

	it('uses the Biology CED point splits', () => {
		expect(
			getFrqFormat('AP Biology', 'long-experimental-analysis')?.parts?.map((part) => part.points)
		).toEqual([1, 3, 3, 2]);
		expect(
			getFrqFormat('AP Biology', 'long-experimental-analysis-with-graphing')?.parts?.map(
				(part) => part.points
			)
		).toEqual([1, 4, 2, 2]);
		for (const formatId of [
			'short-scientific-investigation',
			'short-conceptual-analysis',
			'short-model-or-visual-analysis',
			'short-data-analysis'
		]) {
			expect(getFrqFormat('AP Biology', formatId)?.parts?.map((part) => part.points)).toEqual([
				1, 1, 1, 1
			]);
		}
	});

	it('uses the World History SAQ, DBQ, and LEQ rows', () => {
		for (const formatId of [
			'secondary-text-source',
			'primary-text-source',
			'primary-or-secondary-non-text-source'
		]) {
			const format = getFrqFormat('AP World History', formatId);
			expect(format?.responseMode).toBe('parts');
			expect(format?.parts?.map((part) => [part.id, part.points])).toEqual([
				['A', 1],
				['B', 1],
				['C', 1]
			]);
		}
		const dbq = getFrqFormat('AP World History', 'document-based-question');
		expect(dbq?.responseMode).toBe('essay');
		expect(dbq?.materialMax).toBe(7);
		expect(dbq?.parts?.map((part) => [part.id, part.points])).toEqual([
			['thesis', 1],
			['context', 1],
			['evidence-documents', 2],
			['evidence-beyond', 1],
			['sourcing', 1],
			['complexity', 1]
		]);
		const leq = getFrqFormat('AP World History', 'long-essay');
		expect(leq?.responseMode).toBe('essay');
		expect(leq?.materialMax).toBe(0);
		expect(leq?.parts?.map((part) => [part.id, part.points])).toEqual([
			['thesis', 1],
			['context', 1],
			['evidence', 2],
			['reasoning', 2]
		]);
	});

	it('accepts one format record per call and keeps answers private', () => {
		for (const courseName of COURSES) {
			for (const formatId of examFormatIds(courseName)) {
				const format = getFrqFormat(courseName, formatId);
				if (!format) throw new Error(`Missing ${formatId}`);
				const question = parseGeneratedFrq(courseName, 'Unit 1', generatedFor(format), formatId);
				expect(question.formatId).toBe(formatId);
				expect(frqTotalPoints(question)).toBe(format.pointTotal);
				expect(frqResponseIds(question)).toEqual(
					format.responseMode === 'essay' ? ['essay'] : question.parts.map((part) => part.id)
				);
				const publicQuestion = toPublicFrqQuestion('question-1', question);
				expect(JSON.stringify(publicQuestion)).not.toContain('"answer"');
				expect(JSON.stringify(publicQuestion)).not.toContain('"earns"');
			}
		}
	});

	it('enforces Chemistry sums of 10 and 4', () => {
		const longAnswer = getFrqFormat('AP Chemistry', 'long-answer');
		const shortAnswer = getFrqFormat('AP Chemistry', 'short-answer');
		expect(longAnswer?.parts).toBeUndefined();
		expect(shortAnswer?.parts).toBeUndefined();
		expect(longAnswer?.pointTotal).toBe(10);
		expect(shortAnswer?.pointTotal).toBe(4);

		const short = generatedFor(shortAnswer!);
		expect(parseGeneratedFrq('AP Chemistry', 'Unit 1', short, 'short-answer').parts).toHaveLength(
			4
		);

		short.parts = [
			{
				...short.parts[0]!,
				points: 2,
				earns: 'Award point 1 for the setup. Award point 2 for the value.'
			},
			short.parts[1]!,
			short.parts[2]!
		];
		expect(frqTotalPoints(parseGeneratedFrq('AP Chemistry', 'Unit 1', short, 'short-answer'))).toBe(
			4
		);

		short.parts[0] = {
			...short.parts[0]!,
			points: 3,
			earns:
				'Award point 1 for the setup. Award point 2 for the value. Award point 3 for the units.'
		};
		expect(() => parseGeneratedFrq('AP Chemistry', 'Unit 1', short, 'short-answer')).toThrow(
			'Parts must sum to 4'
		);

		const undivided = generatedFor(longAnswer!);
		undivided.parts[0] = {
			...undivided.parts[0]!,
			points: 2,
			earns: 'Award point 2 then point 1.'
		};
		undivided.parts.pop();
		expect(() => parseGeneratedFrq('AP Chemistry', 'Unit 1', undivided, 'long-answer')).toThrow(
			'name each point in order'
		);
	});

	it('reads control and scope from the course record', () => {
		expect(frqPracticeFor('AP English Language')).toMatchObject({ control: 'task', scope: 'none' });
		expect(frqPracticeFor('AP Human Geography')).toMatchObject({
			control: 'task',
			scope: 'multi-unit'
		});
		expect(frqPracticeFor('AP World History')).toMatchObject({ control: 'task', scope: 'period' });
		expect(frqPracticeFor('AP Biology')).toMatchObject({ control: 'unit', scope: 'single-unit' });
		expect(frqPracticeFor('AP Chemistry')).toMatchObject({ control: 'unit', scope: 'anchor' });
		expect(frqPracticeFor('AP English Language')?.tasks).toEqual([
			{ formatId: 'synthesis', label: 'Synthesis' },
			{ formatId: 'rhetorical-analysis', label: 'Rhetorical analysis' },
			{ formatId: 'argument', label: 'Argument' }
		]);
		expect(frqPracticeFor('AP Human Geography')?.tasks.map((task) => task.label)).toEqual([
			'No stimulus',
			'One stimulus',
			'Two stimuli'
		]);
		expect(frqPracticeFor('AP World History')?.tasks.map((task) => task.label)).toEqual([
			'Secondary text',
			'Primary text',
			'Non-text source',
			'Document-based',
			'Long essay'
		]);
	});

	it('adds one scope sentence and stores task courses as All Units', () => {
		const english = buildFrqGenerationPrompt('AP English Language', 'All Units', [], 'argument');
		expect(english.system).not.toContain('Unit:');
		expect(english.system).not.toContain(FRQ_SCOPE_SENTENCE['single-unit']);
		expect(english.user).toBe('Create an original AP English Language argument task.');

		const geography = buildFrqGenerationPrompt(
			'AP Human Geography',
			'All Units',
			[],
			'no-stimulus-scenario'
		);
		expect(geography.system).toContain(FRQ_SCOPE_SENTENCE['multi-unit']);
		expect(geography.system).not.toContain('Unit:');
		expect(geography.system).not.toContain('Unit keywords');

		const history = buildFrqGenerationPrompt('AP World History', 'All Units', [], 'long-essay');
		expect(history.system).toContain(FRQ_SCOPE_SENTENCE.period);
		expect(history.system).toContain('about half the course');
		expect(history.system).not.toContain('Unit keywords');

		const biologyUnit = 'Unit 1: Chemistry of Life';
		const biology = buildFrqGenerationPrompt(
			'AP Biology',
			biologyUnit,
			[],
			'short-conceptual-analysis'
		);
		expect(biology.system).toContain(`Unit: ${biologyUnit}`);
		expect(biology.system).toContain(FRQ_SCOPE_SENTENCE['single-unit']);
		expect(biology.user).toContain(biologyUnit);

		const chemistryUnit = 'Unit 4: Chemical Reactions';
		const chemistry = buildFrqGenerationPrompt('AP Chemistry', chemistryUnit, [], 'long-answer');
		expect(chemistry.system).toContain(`Unit: ${chemistryUnit}`);
		expect(chemistry.system).toContain(FRQ_SCOPE_SENTENCE.anchor);

		expect(
			parseGeneratedFrq('AP English Language', 'Unit 1', generatedFor(english.format), 'argument')
				.unit
		).toBe('All Units');
		expect(
			parseGeneratedFrq(
				'AP Biology',
				biologyUnit,
				generatedFor(biology.format),
				'short-conceptual-analysis'
			).unit
		).toBe(biologyUnit);
	});

	it('rewrites an empty unit selection only for unit courses', () => {
		const english = resolveFrqPoolRequest('AP English Language', '', 'synthesis');
		expect(english).toEqual({
			storedUnit: 'All Units',
			poolUnit: 'synthesis',
			formatId: 'synthesis'
		});
		const biology = resolveFrqPoolRequest('AP Biology', '');
		expect(getUnitsForClass('AP Biology')).toContain(biology.storedUnit);
		expect(biology.poolUnit).toBe(biology.storedUnit);
		const chemistry = resolveFrqPoolRequest('AP Chemistry', 'All Units');
		expect(getUnitsForClass('AP Chemistry')).toContain(chemistry.storedUnit);
		expect(chemistry.poolUnit).toBe(chemistry.storedUnit);
		const kept = resolveFrqPoolRequest('AP Biology', 'Unit 3: Cellular Energetics');
		expect(kept.storedUnit).toBe('Unit 3: Cellular Energetics');
	});
});
