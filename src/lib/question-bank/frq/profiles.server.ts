export type FrqResponseMode = 'essay' | 'parts';

export type FrqFixedPart = {
	id: string;
	label: string;
	points: number;
	prompt?: string;
	earns?: string;
};

/** One generation call receives one of these records. */
export type FrqFormatRecord = {
	formatId: string;
	responseMode: FrqResponseMode;
	materialMin: number;
	materialMax: number;
	pointTotal: number;
	/** Absent when the model writes the parts under `pointTotal` (Chemistry). */
	parts?: readonly FrqFixedPart[];
	guidance: string;
	gradingGuidance: string;
};

export type FrqFormatWire = {
	formatId: string;
	responseMode: FrqResponseMode;
	materialMin: number;
	materialMax: number;
	pointTotal: number;
	parts?: { id: string; label: string; points: number }[];
};

const ORIGINAL =
	'Use wholly original content. Do not copy or closely imitate an identifiable exam question, passage, or scoring guideline.';

function letters(points: readonly number[]): FrqFixedPart[] {
	return points.map((value, index) => {
		const label = String.fromCharCode(65 + index);
		return { id: label, label, points: value };
	});
}

function format(record: FrqFormatRecord): FrqFormatRecord {
	return record;
}

const englishThesis: FrqFixedPart = {
	id: 'thesis',
	label: 'Thesis',
	points: 1,
	prompt:
		'State a defensible thesis that responds to the prompt and establishes a line of reasoning.',
	earns:
		'Award 1 for a defensible thesis that responds to the prompt and establishes a line of reasoning. Award 0 otherwise.'
};

const englishEvidencePrompt =
	'Support the thesis with specific evidence and commentary that explain how the evidence develops the line of reasoning.';

const englishSophistication: FrqFixedPart = {
	id: 'sophistication',
	label: 'Sophistication',
	points: 1,
	prompt: 'Demonstrate sophistication of thought in the argument.',
	earns:
		'Award 1 for one sustained sophistication move, such as a qualification, a tension, or an implication that deepens the argument. Award 0 otherwise.'
};

function englishEvidence(earns: string): FrqFixedPart {
	return {
		id: 'evidence-commentary',
		label: 'Evidence and Commentary',
		points: 4,
		prompt: englishEvidencePrompt,
		earns
	};
}

const ENGLISH_GRADING =
	'Score the single essay on the three fixed rows. Award every integer from 0 through that row’s points. Grammar limits only point 4 of Evidence and Commentary, when errors interfere with meaning.';

const historyThesis: FrqFixedPart = {
	id: 'thesis',
	label: 'Thesis',
	points: 1,
	prompt: 'State a historically defensible claim that establishes a line of reasoning.',
	earns:
		'Award 1 for a historically defensible claim with a line of reasoning, stated in one place. Award 0 otherwise.'
};

const historyContext: FrqFixedPart = {
	id: 'context',
	label: 'Contextualization',
	points: 1,
	prompt: 'Describe broader historical context relevant to the prompt.',
	earns:
		'Award 1 for broader context of more than a phrase, distinct from evidence used outside the documents. Award 0 otherwise.'
};

const HUMAN_PARTS = letters([1, 1, 1, 1, 1, 1, 1]);
const SAQ_PARTS = letters([1, 1, 1]);
const BIO_SHORT_PARTS = letters([1, 1, 1, 1]);

const FORMATS: Record<string, readonly FrqFormatRecord[]> = {
	'AP Human Geography': [
		format({
			formatId: 'no-stimulus-scenario',
			responseMode: 'parts',
			materialMin: 0,
			materialMax: 0,
			pointTotal: 7,
			parts: HUMAN_PARTS,
			guidance: `${ORIGINAL} Write one geographic scenario. About 25 minutes. Exactly seven student tasks, A–G, at 1 point each. Each part uses one task verb: identify, define, describe, explain, or compare. Explain-the-degree is still 1 point: the response states low, moderate, or high and gives the cause. You write each part’s student prompt, an earns line in that verb’s terms, and one acceptable response.`,
			gradingGuidance:
				'Score each part separately. Award 0 or 1 in the terms of that part’s earns line.'
		}),
		format({
			formatId: 'one-stimulus-scenario',
			responseMode: 'parts',
			materialMin: 1,
			materialMax: 1,
			pointTotal: 7,
			parts: HUMAN_PARTS,
			guidance: `${ORIGINAL} Write one geographic scenario and exactly one stimulus (data, an image, or a map). About 25 minutes. Exactly seven student tasks, A–G, at 1 point each, each with one task verb. A stimulus-locked part is earned only from the material. Other parts may use course concepts and do not have to read the stimulus. You write each part’s prompt, earns line, and one acceptable response.`,
			gradingGuidance:
				'Score each part separately. Award 0 or 1. A stimulus-locked part earns its point only from the supplied material.'
		}),
		format({
			formatId: 'two-stimulus-scenario',
			responseMode: 'parts',
			materialMin: 2,
			materialMax: 2,
			pointTotal: 7,
			parts: HUMAN_PARTS,
			guidance: `${ORIGINAL} Write one geographic scenario and exactly two stimuli (data, images, and/or maps). About 25 minutes. Exactly seven student tasks, A–G, at 1 point each, each with one task verb. A stimulus-locked part is earned only from the materials. You write each part’s prompt, earns line, and one acceptable response.`,
			gradingGuidance:
				'Score each part separately. Award 0 or 1. A stimulus-locked part earns its point only from the supplied materials.'
		})
	],
	'AP English Language': [
		format({
			formatId: 'synthesis',
			responseMode: 'essay',
			materialMin: 6,
			materialMax: 6,
			pointTotal: 6,
			parts: [
				englishThesis,
				englishEvidence(
					'Award point 1 for evidence or commentary that is only general. Award point 2 for specific evidence from the sources with limited commentary. Award point 3 for specific evidence and commentary that support a line of reasoning, using at least three of the six sources. Award point 4 when that support is consistent and errors do not interfere with meaning. Award 0 when the response lacks defensible evidence or commentary.'
				),
				englishSophistication
			],
			guidance: `${ORIGINAL} One synthesis essay, about 40 minutes to write after the sources are read. Never blend this with rhetorical analysis or argument. Provide exactly six original sources. Two are visual, and at least one of those two is quantitative. The other four are prose of about 500 words. Sources must be citable and must support more than one defensible position. The essay uses at least three sources. You write the assignment prompt and the sources. For each fixed part, echo the id and write only the private answer: a sample line of reasoning for these sources, plus one sustained sophistication move.`,
			gradingGuidance: ENGLISH_GRADING
		}),
		format({
			formatId: 'rhetorical-analysis',
			responseMode: 'essay',
			materialMin: 1,
			materialMax: 1,
			pointTotal: 6,
			parts: [
				englishThesis,
				englishEvidence(
					'Award point 1 for evidence or commentary that is only general. Award point 2 for specific choices from the passage with limited commentary. Award point 3 for specific choices and commentary that explain how they contribute to the writer’s purpose, argument, or message. Award point 4 when that explanation is consistent and errors do not interfere with meaning. Award 0 when the response lacks defensible evidence or commentary.'
				),
				englishSophistication
			],
			guidance: `${ORIGINAL} One rhetorical-analysis essay, about 40 minutes. Provide exactly one original nonfiction passage of about 600–800 words, plus the writer, occasion, audience, context, and a named purpose, argument, or message. The passage must contain choices a student can analyze. You write the assignment and the passage. For each fixed part, echo the id and write only the private answer.`,
			gradingGuidance: ENGLISH_GRADING
		}),
		format({
			formatId: 'argument',
			responseMode: 'essay',
			materialMin: 0,
			materialMax: 0,
			pointTotal: 6,
			parts: [
				englishThesis,
				englishEvidence(
					'Award point 1 for evidence or commentary that is only general. Award point 2 for specific evidence with limited commentary. Award point 3 for specific evidence and commentary that support a line of reasoning. Award point 4 when that support is consistent and errors do not interfere with meaning. Award 0 when the response lacks defensible evidence or commentary. There is no source-count rule.'
				),
				{
					...englishSophistication,
					earns:
						'Award 1 for one sustained sophistication move. Understanding of the rhetorical situation, when it is scored, belongs on this row as 0 or 1. Award 0 otherwise.'
				}
			],
			guidance: `${ORIGINAL} One argument essay, about 40 minutes. No sources. Provide a short attributed claim that is debatable, and ask for the extent to which the claim is valid. You write the assignment. For each fixed part, echo the id and write only the private answer: a sample line of reasoning, plus one sustained sophistication move.`,
			gradingGuidance: ENGLISH_GRADING
		})
	],
	'AP World History': [
		format({
			formatId: 'secondary-text-source',
			responseMode: 'parts',
			materialMin: 1,
			materialMax: 1,
			pointTotal: 3,
			parts: SAQ_PARTS,
			guidance: `${ORIGINAL} One short-answer question on a secondary text, inside 1200–2001. Exactly one secondary text source. Three student tasks, A–C, at 1 point each. At least one part asks for knowledge beyond the stimulus. You write each part’s prompt, an earns line, and one acceptable response.`,
			gradingGuidance: 'Score each part separately. Award 0 or 1 from that part’s earns line.'
		}),
		format({
			formatId: 'primary-text-source',
			responseMode: 'parts',
			materialMin: 1,
			materialMax: 1,
			pointTotal: 3,
			parts: SAQ_PARTS,
			guidance: `${ORIGINAL} One short-answer question on a primary text, inside 1200–2001. Exactly one primary text source. Three student tasks, A–C, at 1 point each. At least one part asks for knowledge beyond the stimulus. You write each part’s prompt, an earns line, and one acceptable response.`,
			gradingGuidance: 'Score each part separately. Award 0 or 1 from that part’s earns line.'
		}),
		format({
			formatId: 'primary-or-secondary-non-text-source',
			responseMode: 'parts',
			materialMin: 1,
			materialMax: 1,
			pointTotal: 3,
			parts: SAQ_PARTS,
			guidance: `${ORIGINAL} One short-answer question on a primary or secondary non-text source, inside 1200–2001. The source must be analyzable as text: a written table or a fully specified chart. Three student tasks, A–C, at 1 point each. At least one part asks for knowledge beyond the stimulus. You write each part’s prompt, an earns line, and one acceptable response.`,
			gradingGuidance: 'Score each part separately. Award 0 or 1 from that part’s earns line.'
		}),
		format({
			formatId: 'document-based-question',
			responseMode: 'essay',
			materialMin: 7,
			materialMax: 7,
			pointTotal: 7,
			parts: [
				historyThesis,
				historyContext,
				{
					id: 'evidence-documents',
					label: 'Evidence from the documents',
					points: 2,
					prompt: 'Use the documents to support an argument.',
					earns:
						'Award point 1 for describing at least three documents. Award point 2 for supporting an argument with at least four documents. Award 0 when fewer than three documents are described.'
				},
				{
					id: 'evidence-beyond',
					label: 'Evidence beyond the documents',
					points: 1,
					prompt: 'Use one specific piece of evidence from outside the documents in the argument.',
					earns:
						'Award 1 for one specific piece of evidence that is not in the documents and is used in the argument. Award 0 otherwise.'
				},
				{
					id: 'sourcing',
					label: 'Sourcing',
					points: 1,
					prompt:
						'For at least two documents, explain how or why point of view, purpose, historical situation, and/or audience matters.',
					earns:
						'Award 1 for explaining how or why point of view, purpose, situation, and/or audience matters for at least two documents. Award 0 otherwise.'
				},
				{
					id: 'complexity',
					label: 'Complexity',
					points: 1,
					prompt: 'Demonstrate a complex understanding inside the argument.',
					earns:
						'Award 1 for a complex understanding developed inside the argument by one established route, such as a corroborating qualification, a connection across periods, or using all seven documents to support an argument. Award 0 otherwise.'
				}
			],
			guidance: `${ORIGINAL} One document-based question, about 60 minutes including 15 minutes to read. Stay inside 1200–2001. Exactly seven original documents with different perspectives. None of them contains the outside-evidence example. You write the prompt and the documents. For each fixed row, echo the id and write only the private answer that could earn the points. The student writes one essay.`,
			gradingGuidance:
				'Score the single essay on the six fixed rows. Award every integer from 0 through that row’s points. The document row is 0, 1, or 2: 1 for describing three documents, 2 for using four in the argument.'
		}),
		format({
			formatId: 'long-essay',
			responseMode: 'essay',
			materialMin: 0,
			materialMax: 0,
			pointTotal: 6,
			parts: [
				{
					...historyThesis,
					earns:
						'Award 1 for a historically defensible claim with a line of reasoning. The claim need not cover the whole period. Award 0 otherwise.'
				},
				historyContext,
				{
					id: 'evidence',
					label: 'Evidence',
					points: 2,
					prompt: 'Support an argument with specific historical examples.',
					earns:
						'Award point 1 for two specific examples. Award point 2 when those examples support an argument. Award 0 otherwise.'
				},
				{
					id: 'reasoning',
					label: 'Reasoning',
					points: 2,
					prompt: 'Use historical reasoning to frame the argument.',
					earns:
						'Award point 1 when comparison, causation, or continuity and change frames the argument. Award point 2 for complex understanding on that same row. Award 0 otherwise. This is one 0–2 row.'
				}
			],
			guidance: `${ORIGINAL} One long essay, about 40 minutes. No documents. The period is about half the course. Include an orientation sentence and an explicit limit that the essay does not have to cover the whole period. You write the prompt. For each fixed row, echo the id and write only the private answer. The student writes one essay.`,
			gradingGuidance:
				'Score the single essay on the four fixed rows. Award every integer from 0 through that row’s points. Reasoning is one 0–2 row, not two separate tasks.'
		})
	],
	'AP Biology': [
		format({
			formatId: 'long-experimental-analysis',
			responseMode: 'parts',
			materialMin: 1,
			materialMax: 2,
			pointTotal: 9,
			parts: letters([1, 3, 3, 2]),
			guidance: `${ORIGINAL} One long experimental-analysis question, about 25 minutes, worth 9 points: A 1, B 3, C 3, D 2. Provide a scenario plus a table, a graph, or both. Data must make every check decidable. A 3-point part is three independent 1-point checks, and its earns line names point 1, point 2, and point 3 in order. A calculation is at most one of part C’s three points. Math stays on the formula sheet. A graph or marked figure is answered as a written description of the same checks. You write each part’s prompt, earns line, and one acceptable response per point in prompt order.`,
			gradingGuidance:
				'Score parts A–D separately. Award every integer from 0 through that part’s points. A multi-point part is that many independent checks, named in the earns line in order.'
		}),
		format({
			formatId: 'long-experimental-analysis-with-graphing',
			responseMode: 'parts',
			materialMin: 1,
			materialMax: 1,
			pointTotal: 9,
			parts: letters([1, 4, 2, 2]),
			guidance: `${ORIGINAL} One long experimental-analysis question with graphing, about 25 minutes, worth 9 points: A 1, B 4, C 2, D 2. Provide a scenario plus one table. The student constructs the graph in writing. Part B is three graph-construction checks (type, plotted data with error bars, labels) plus one data determination, so its earns line names point 1, point 2, point 3, and point 4. The graph is answered as a written description of those checks. You write each part’s prompt, earns line, and one acceptable response per point.`,
			gradingGuidance:
				'Score parts A–D separately. Award every integer from 0 through that part’s points. Part B has four independent checks.'
		}),
		format({
			formatId: 'short-scientific-investigation',
			responseMode: 'parts',
			materialMin: 0,
			materialMax: 1,
			pointTotal: 4,
			parts: BIO_SHORT_PARTS,
			guidance: `${ORIGINAL} One short scientific-investigation question, about 10 minutes, worth 4 points: A–D at 1 point each. Describe a lab investigation. You write each part’s prompt, a 1-point earns line, and one acceptable response.`,
			gradingGuidance: 'Score each part separately. Award 0 or 1 from that part’s earns line.'
		}),
		format({
			formatId: 'short-conceptual-analysis',
			responseMode: 'parts',
			materialMin: 0,
			materialMax: 1,
			pointTotal: 4,
			parts: BIO_SHORT_PARTS,
			guidance: `${ORIGINAL} One short conceptual-analysis question, about 10 minutes, worth 4 points: A–D at 1 point each. Describe a phenomenon with a disruption. A figure is allowed and is not required. You write each part’s prompt, a 1-point earns line, and one acceptable response.`,
			gradingGuidance: 'Score each part separately. Award 0 or 1 from that part’s earns line.'
		}),
		format({
			formatId: 'short-model-or-visual-analysis',
			responseMode: 'parts',
			materialMin: 1,
			materialMax: 1,
			pointTotal: 4,
			parts: BIO_SHORT_PARTS,
			guidance: `${ORIGINAL} One short model-or-visual-analysis question, about 10 minutes, worth 4 points: A–D at 1 point each. Provide one visual model complete enough that every check is decidable. A “mark the figure” task is answered as a written description of the same checks. You write each part’s prompt, a 1-point earns line, and one acceptable response.`,
			gradingGuidance: 'Score each part separately. Award 0 or 1 from that part’s earns line.'
		}),
		format({
			formatId: 'short-data-analysis',
			responseMode: 'parts',
			materialMin: 1,
			materialMax: 1,
			pointTotal: 4,
			parts: BIO_SHORT_PARTS,
			guidance: `${ORIGINAL} One short data-analysis question, about 10 minutes, worth 4 points: A–D at 1 point each. Provide one graph, table, or other visual. Parts that describe data do not award a point for defining a concept. You write each part’s prompt, a 1-point earns line, and one acceptable response.`,
			gradingGuidance:
				'Score each part separately. Award 0 or 1 from that part’s earns line. Describing data does not earn a point for a definition.'
		})
	],
	'AP Chemistry': [
		format({
			formatId: 'long-answer',
			responseMode: 'parts',
			materialMin: 0,
			materialMax: 4,
			pointTotal: 10,
			guidance: `${ORIGINAL} One long free-response question for this unit, about 23 minutes. You write the parts. Each part is a positive integer number of points, usually 1, and the parts sum to 10. A 2-point part is only undivided work, and its earns line names point 1 and point 2 in order. Include mathematical work. Every number that is not on the periodic table or the equations-and-constants sheet must be in the materials. Calculations tell the student to show work. Say when significant figures, a sign, units, or a graph range are part of the point, and when a later point is consistent with an earlier part. A drawn part is answered as a described diagram. You write each part’s id, label, prompt, points, earns line, and private answer.`,
			gradingGuidance:
				'Score each lettered part from 0 through its points. A later point marked consistent with an earlier part follows the student’s earlier value. Honor significant figures, sign, and units only when the earns line includes them.'
		}),
		format({
			formatId: 'short-answer',
			responseMode: 'parts',
			materialMin: 0,
			materialMax: 3,
			pointTotal: 4,
			guidance: `${ORIGINAL} One short free-response question for this unit, about 9 minutes. You write the parts. Each part is a positive integer number of points, usually 1, and the parts sum to 4. A 2-point part is only undivided work, and its earns line names point 1 and point 2 in order. Every number that is not on the reference sheet must be in the materials. A justification needs the claim and the reason. A drawn part is answered as a described diagram. You write each part’s id, label, prompt, points, earns line, and private answer.`,
			gradingGuidance:
				'Score each lettered part from 0 through its points. Honor significant figures, sign, units, and consistent-with only when the earns line includes them.'
		})
	]
};

function assertFormats(records: readonly FrqFormatRecord[]): void {
	const ids = new Set<string>();
	for (const record of records) {
		if (ids.has(record.formatId)) throw new Error(`Duplicate FRQ format ${record.formatId}`);
		ids.add(record.formatId);
		if (record.materialMin > record.materialMax) {
			throw new Error(`${record.formatId} has an inverted material count`);
		}
		if (record.parts) {
			const partIds = new Set<string>();
			let sum = 0;
			for (const part of record.parts) {
				if (partIds.has(part.id))
					throw new Error(`Duplicate part ${part.id} on ${record.formatId}`);
				partIds.add(part.id);
				sum += part.points;
				if (record.responseMode === 'essay' && (!part.prompt || !part.earns)) {
					throw new Error(
						`${record.formatId} essay row ${part.id} needs a fixed prompt and earns line`
					);
				}
			}
			if (sum !== record.pointTotal) {
				throw new Error(`${record.formatId} parts sum to ${sum}, not ${record.pointTotal}`);
			}
		}
	}
}

for (const records of Object.values(FORMATS)) assertFormats(records);

export function getFrqCourseProfile(
	apClass: string
): { formats: readonly FrqFormatRecord[] } | null {
	const formats = FORMATS[apClass];
	return formats ? { formats } : null;
}

export function getFrqCourseNames(): string[] {
	return Object.keys(FORMATS);
}

export function getFrqFormat(apClass: string, formatId: string): FrqFormatRecord | null {
	return (
		getFrqCourseProfile(apClass)?.formats.find((record) => record.formatId === formatId) ?? null
	);
}

export function selectFrqFormat(apClass: string, formatId?: string): FrqFormatRecord {
	const profile = getFrqCourseProfile(apClass);
	if (!profile) throw new Error('FRQ practice is not available for this course');
	if (!formatId) {
		const index = Math.floor(Math.random() * profile.formats.length);
		return profile.formats[index]!;
	}
	const format = profile.formats.find((record) => record.formatId === formatId);
	if (!format) throw new Error(`Unknown FRQ format ${formatId} for ${apClass}`);
	return format;
}

export function frqFormatWire(record: FrqFormatRecord): FrqFormatWire {
	return {
		formatId: record.formatId,
		responseMode: record.responseMode,
		materialMin: record.materialMin,
		materialMax: record.materialMax,
		pointTotal: record.pointTotal,
		...(record.parts
			? {
					parts: record.parts.map((part) => ({
						id: part.id,
						label: part.label,
						points: part.points
					}))
				}
			: {})
	};
}
