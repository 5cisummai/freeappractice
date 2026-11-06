import { parseMcqQuestionPayload } from '#lib/question-bank/mcq/payload-schema.js';

export const SEO_SAMPLE_QUESTION_LIMIT = 5;

export const SEO_SAMPLE_OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export type SeoSampleOptionLetter = (typeof SEO_SAMPLE_OPTION_LETTERS)[number];

export type SeoSampleQuestion = {
	questionId: string;
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: SeoSampleOptionLetter;
	explanation: string;
};

export type SeoSampleQuestionCandidate = SeoSampleQuestion & {
	course: string;
	unit: string;
	hasDiagram?: boolean;
	stimulus?: unknown;
	stimulusId?: string | null;
	diagramSpec?: unknown;
};

export type SeoSampleQuestionsSnapshot = Record<string, string[]>;

export type SeoSamplePage = {
	slug: string;
	type: 'course' | 'unit';
	course: string;
	unit?: string;
};

function formatSampleUnitName(page: SeoSamplePage): string {
	if (page.unit) return page.unit.replace(/^(?:Unit|Big Idea)\s+\d+:\s*/, '');
	return page.course;
}

function isOptionLetter(value: string): value is SeoSampleOptionLetter {
	return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

export function sampleQuestionOptionText(
	question: SeoSampleQuestion,
	letter: SeoSampleOptionLetter
): string {
	switch (letter) {
		case 'A':
			return question.optionA;
		case 'B':
			return question.optionB;
		case 'C':
			return question.optionC;
		case 'D':
			return question.optionD;
		default: {
			const _exhaustive: never = letter;
			return _exhaustive;
		}
	}
}

export function isSeoSampleQuestionEligible(candidate: SeoSampleQuestionCandidate): boolean {
	if (candidate.hasDiagram || candidate.diagramSpec) return false;
	if (candidate.stimulus || candidate.stimulusId) return false;
	if (!candidate.questionId.trim() || !candidate.question.trim() || !candidate.explanation.trim())
		return false;
	if (!isOptionLetter(candidate.correctAnswer)) return false;
	return SEO_SAMPLE_OPTION_LETTERS.every((letter) =>
		sampleQuestionOptionText(candidate, letter).trim()
	);
}

export function parseSeoSampleQuestionCandidate(
	questionId: string,
	data: unknown
): SeoSampleQuestionCandidate | null {
	try {
		const payload = parseMcqQuestionPayload(data);
		if (!payload.unit) return null;
		return { ...payload, unit: payload.unit, questionId };
	} catch {
		return null;
	}
}

function toSeoSampleQuestion(candidate: SeoSampleQuestionCandidate): SeoSampleQuestion {
	return {
		questionId: candidate.questionId.trim(),
		question: candidate.question.trim(),
		optionA: candidate.optionA.trim(),
		optionB: candidate.optionB.trim(),
		optionC: candidate.optionC.trim(),
		optionD: candidate.optionD.trim(),
		correctAnswer: candidate.correctAnswer,
		explanation: candidate.explanation.trim()
	};
}

/** Deterministic 3–5 sample MCQs for a unit. Stable across rebuilds for the same pool rows. */
export function selectSeoSampleQuestions(
	candidates: readonly SeoSampleQuestionCandidate[],
	limit = SEO_SAMPLE_QUESTION_LIMIT
): SeoSampleQuestion[] {
	return [...candidates]
		.filter(isSeoSampleQuestionEligible)
		.sort((a, b) => a.questionId.localeCompare(b.questionId))
		.slice(0, Math.max(0, limit))
		.map(toSeoSampleQuestion);
}

export function buildSeoSampleQuestionsSnapshot(
	candidates: readonly SeoSampleQuestionCandidate[],
	pages: readonly SeoSamplePage[]
): SeoSampleQuestionsSnapshot {
	const byBucket = new Map<string, SeoSampleQuestionCandidate[]>();
	for (const candidate of candidates) {
		const key = `${candidate.course}\u0000${candidate.unit}`;
		const list = byBucket.get(key);
		if (list) list.push(candidate);
		else byBucket.set(key, [candidate]);
	}

	const questionsBySlug: SeoSampleQuestionsSnapshot = {};
	for (const page of pages) {
		if (page.type !== 'unit' || !page.unit) continue;
		const selected = selectSeoSampleQuestions(
			byBucket.get(`${page.course}\u0000${page.unit}`) ?? []
		);
		if (selected.length > 0)
			questionsBySlug[page.slug] = selected.map((question) => question.questionId);
	}

	return questionsBySlug;
}

export function getSeoSampleQuestionsForSlug(
	snapshot: SeoSampleQuestionsSnapshot,
	slug: string
): string[] {
	return Object.hasOwn(snapshot, slug) ? snapshot[slug]! : [];
}

export function buildSampleQuestionsJsonLd(
	page: SeoSamplePage,
	samples: readonly SeoSampleQuestion[]
): Record<string, unknown> | null {
	if (page.type !== 'unit' || samples.length === 0) return null;

	const unitName = formatSampleUnitName(page);

	return {
		'@context': 'https://schema.org',
		'@type': 'Quiz',
		name: `${page.course} ${unitName} practice questions`,
		educationalLevel: 'High School',
		isAccessibleForFree: true,
		learningResourceType: 'Practice Quiz',
		hasPart: samples.map((sample) => ({
			'@type': 'Question',
			eduQuestionType: 'Multiple choice',
			text: sample.question,
			suggestedAnswer: SEO_SAMPLE_OPTION_LETTERS.map((letter) => ({
				'@type': 'Answer',
				text: `${letter}. ${sampleQuestionOptionText(sample, letter)}`
			})),
			acceptedAnswer: {
				'@type': 'Answer',
				text: `${sample.correctAnswer}. ${sampleQuestionOptionText(sample, sample.correctAnswer)}`
			}
		}))
	};
}
