import { getUnitsForCourse } from '#lib/catalog/courses.js';
import { resolveQuestionMainTopic } from '#lib/question-bank/main-topic.js';
import {
	findActiveQuestionsForQuiz,
	findCachedQuestions,
	storedQuestionFromPayload,
	type IQuestion
} from '#lib/question-bank/mcq/repository.server.js';
import { storedQuestionToGenerated } from '#lib/question-bank/mcq/public-payload.server.js';
import {
	getStimulusPolicy,
	isStimulusPolicyEnabledForUnit,
	type StimulusPolicy
} from '#lib/question-bank/mcq/stimulus-policy.js';
import type { GeneratedQuestion } from '#lib/question-bank/mcq/types.js';
import { logger } from '#lib/server/logger.js';

export type QuizAssemblyInput = {
	course: string;
	unit?: string;
	unitRange?: readonly number[];
	count: number;
	focusQuestionIds?: string[];
	excludeQuestionIds?: string[];
};

export type QuizAssemblyMetrics = {
	requestedCount: number;
	selectedCount: number;
	stimulusTargetQuestionCount: number;
	stimulusTargetDeviation: number;
	stimulusQuestionCount: number;
	stimulusSetCount: number;
	discreteQuestionCount: number;
	truncatedSetCount: number;
	policyEnabled: boolean;
	globalFlagEnabled: boolean;
	focusMatchedCount?: number;
};

export type QuizAssemblyResult = {
	questions: GeneratedQuestion[];
	metrics: QuizAssemblyMetrics;
};

export class QuizPoolWarmingError extends Error {
	readonly code = 'POOL_WARMING';
	readonly availableCount: number;

	constructor(message = 'Question pool is warming up. Please retry shortly.', availableCount = 0) {
		super(message);
		this.name = 'QuizPoolWarmingError';
		this.availableCount = availableCount;
	}
}

type QuizBlock =
	| { kind: 'discrete'; question: IQuestion; unit: string }
	| {
			kind: 'set';
			stimulusId: string;
			children: IQuestion[];
			unit: string;
	  };

function shuffle<T>(values: T[]): T[] {
	const result = [...values];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
	}
	return result;
}

export function resolveQuizUnits(
	course: string,
	unit: string | undefined,
	unitRange?: readonly number[]
): string[] {
	if (unit?.trim()) return [unit.trim()];
	const units = getUnitsForCourse(course);
	if (!units.length) return [];
	const maxIndex = units.length - 1;
	const start = Math.min(Math.max(Math.trunc(unitRange?.[0] ?? 0), 0), maxIndex);
	const end = Math.min(Math.max(Math.trunc(unitRange?.[1] ?? maxIndex), 0), maxIndex);
	return units.slice(Math.min(start, end), Math.max(start, end) + 1);
}

function toGenerated(question: IQuestion): GeneratedQuestion {
	return storedQuestionToGenerated(
		storedQuestionFromPayload({
			questionId: question.questionId,
			data: question,
			contentHash: question.contentHash,
			createdAt: question.createdAt
		})
	);
}

function hasStructuredStimulus(question: IQuestion): boolean {
	return Boolean(question.stimulus && (question.stimulus.text || question.stimulus.diagramSpec));
}

function hasAllowedDiagram(question: IQuestion, policy: StimulusPolicy): boolean {
	if (!question.diagramSpec && !question.stimulus?.diagramSpec) return true;
	const spec = question.diagramSpec ?? question.stimulus?.diagramSpec;
	const type = typeof spec?.type === 'string' ? spec.type : '';
	if (question.stimulus?.diagramSpec) {
		return policy.profiles.some((profile) => profile.diagramTypes.includes(type));
	}
	return policy.allowDiscreteDiagrams && policy.allowedDiscreteDiagramTypes.includes(type);
}

function buildBlocks(
	questions: IQuestion[],
	globalFlagEnabled: boolean,
	policy: StimulusPolicy
): QuizBlock[] {
	const blocks: QuizBlock[] = [];
	const byStimulus = new Map<string, IQuestion[]>();

	for (const question of questions) {
		if (
			globalFlagEnabled &&
			(question.diagramSpec || question.hasDiagram) &&
			!hasAllowedDiagram(question, policy)
		)
			continue;
		const stimulusId = question.stimulusId?.trim();
		if (globalFlagEnabled && stimulusId && hasStructuredStimulus(question)) {
			const group = byStimulus.get(stimulusId) ?? [];
			group.push(question);
			byStimulus.set(stimulusId, group);
			continue;
		}
		if (globalFlagEnabled && hasStructuredStimulus(question)) {
			blocks.push({ kind: 'discrete', question, unit: question.unit });
			continue;
		}
		if (
			!globalFlagEnabled &&
			(hasStructuredStimulus(question) ||
				question.hasDiagram ||
				question.diagramSpec ||
				question.stimulus?.diagramSpec)
		)
			continue;
		if (globalFlagEnabled || (!question.hasDiagram && !question.diagramSpec)) {
			blocks.push({ kind: 'discrete', question, unit: question.unit });
		} else if (hasAllowedDiagram(question, policy)) {
			blocks.push({ kind: 'discrete', question, unit: question.unit });
		}
	}

	for (const [stimulusId, group] of byStimulus) {
		const sorted = [...group].sort(
			(a, b) =>
				(a.stimulusPosition ?? Number.MAX_SAFE_INTEGER) -
				(b.stimulusPosition ?? Number.MAX_SAFE_INTEGER)
		);
		const expected = sorted[0]?.stimulusQuestionCount;
		const positions = sorted.map((question) => question.stimulusPosition);
		const sameUnit = new Set(sorted.map((question) => question.unit)).size === 1;
		const valid =
			sorted.length > 0 &&
			sameUnit &&
			(!expected || expected >= sorted.length) &&
			positions.every(
				(position, index) =>
					position !== null && position !== undefined && positions.indexOf(position) === index
			);
		if (!valid) {
			for (const question of sorted)
				blocks.push({ kind: 'discrete', question, unit: question.unit });
			continue;
		}
		blocks.push({ kind: 'set', stimulusId, children: sorted, unit: sorted[0]!.unit });
	}

	return blocks;
}

function blockSize(block: QuizBlock, remainingSlots: number): number {
	return block.kind === 'set' ? Math.min(remainingSlots, block.children.length) : 1;
}

/** Choose a block that moves the quiz toward its course-specific stimulus target. */
function chooseBlock(
	blocks: QuizBlock[],
	remainingSlots: number,
	currentStimulusCount: number,
	targetStimulusCount: number
): QuizBlock | null {
	if (!blocks.length) return null;
	const remainingTarget = Math.max(0, targetStimulusCount - currentStimulusCount);
	const fittingSets =
		remainingTarget > 0
			? blocks.filter(
					(block) => block.kind === 'set' && blockSize(block, remainingSlots) <= remainingTarget
				)
			: [];
	if (fittingSets.length) return shuffle(fittingSets)[0] ?? null;

	const scored = blocks.map((block) => {
		const addsStimulus = block.kind === 'set' ? blockSize(block, remainingSlots) : 0;
		const nextStimulusCount = currentStimulusCount + addsStimulus;
		const distance = Math.abs(targetStimulusCount - nextStimulusCount);
		const overshoot = Math.max(0, nextStimulusCount - targetStimulusCount);
		const kindTieBreak =
			remainingTarget === 0 ? (block.kind === 'discrete' ? 0 : 1) : block.kind === 'set' ? 0 : 1;
		return { block, score: [distance, overshoot, kindTieBreak] as const };
	});
	scored.sort((left, right) => {
		for (let index = 0; index < left.score.length; index += 1) {
			if (left.score[index] !== right.score[index]) return left.score[index] - right.score[index];
		}
		return 0;
	});
	const bestScore = scored[0]?.score;
	if (!bestScore) return null;
	const ties = scored
		.filter((entry) => entry.score.every((value, index) => value === bestScore[index]))
		.map((entry) => entry.block);
	return shuffle(ties)[0] ?? null;
}

function takeFromBlock(block: QuizBlock, capacity: number): IQuestion[] {
	if (capacity <= 0) return [];
	if (block.kind === 'discrete') return [block.question];
	const take = Math.min(capacity, block.children.length);
	const start = Math.floor(Math.random() * (block.children.length - take + 1));
	return block.children.slice(start, start + take);
}

function normalizeTopicLabel(value: string): string {
	return value.trim().toLowerCase();
}

function questionTopicLabels(question: IQuestion): string[] {
	const main = normalizeTopicLabel(
		resolveQuestionMainTopic(question.mainTopic, question.topicsCovered)
	);
	const labels = main ? [main] : [];
	const covered = question.topicsCovered?.trim();
	if (covered) labels.push(normalizeTopicLabel(covered));
	return [...new Set(labels.filter(Boolean))];
}

function questionMatchesMissedTopics(question: IQuestion, missedTopics: Set<string>): boolean {
	const labels = questionTopicLabels(question);
	if (labels.some((label) => missedTopics.has(label))) return true;
	const covered = question.topicsCovered?.trim().toLowerCase();
	if (!covered) return false;
	for (const missed of missedTopics) {
		if (covered.includes(missed)) return true;
	}
	return false;
}

function blockMatchesTopics(block: QuizBlock, missedTopics: Set<string>): boolean {
	const questions = block.kind === 'set' ? block.children : [block.question];
	return questions.some((question) => questionMatchesMissedTopics(question, missedTopics));
}

function countTopicMatchedQuestions(questions: IQuestion[], missedTopics: Set<string>): number {
	return questions.filter((question) => questionMatchesMissedTopics(question, missedTopics)).length;
}

export async function assembleMcqQuiz(
	input: QuizAssemblyInput,
	options: { globalFlagEnabled: boolean }
): Promise<QuizAssemblyResult> {
	const requestedCount = Math.min(50, Math.max(1, Math.floor(input.count)));
	const focusQuestionIds = [
		...new Set((input.focusQuestionIds ?? []).map((id) => id.trim()).filter(Boolean))
	];
	const focusMode = focusQuestionIds.length > 0;
	const policy = getStimulusPolicy(input.course);
	let units = resolveQuizUnits(input.course, input.unit, input.unitRange);
	let excludeQuestionIds = [
		...new Set((input.excludeQuestionIds ?? []).map((id) => id.trim()).filter(Boolean))
	];
	const missedTopics = new Set<string>();

	if (focusMode) {
		const missedQuestions = await findCachedQuestions(focusQuestionIds);
		const missedUnits = [
			...new Set(missedQuestions.map((question) => question.unit.trim()).filter(Boolean))
		];
		if (missedUnits.length) {
			const allowed = new Set(units);
			units = missedUnits.filter((unit) => !allowed.size || allowed.has(unit));
			if (!units.length) units = missedUnits;
		}
		for (const question of missedQuestions) {
			for (const label of questionTopicLabels(question)) missedTopics.add(label);
		}
		excludeQuestionIds = [...new Set([...excludeQuestionIds, ...focusQuestionIds])];
	}

	const stimulusTargetEnabled =
		options.globalFlagEnabled && units.some((unit) => isStimulusPolicyEnabledForUnit(policy, unit));
	const rows = await findActiveQuestionsForQuiz({
		course: input.course,
		units,
		limit: focusMode ? Math.max(requestedCount, 50) : requestedCount,
		excludeQuestionIds: excludeQuestionIds.length ? excludeQuestionIds : undefined
	});
	const allBlocks = buildBlocks(rows, options.globalFlagEnabled, policy);
	const matchedBlocks = focusMode
		? allBlocks.filter((block) => blockMatchesTopics(block, missedTopics))
		: allBlocks;
	const unmatchedBlocks = focusMode
		? allBlocks.filter((block) => !blockMatchesTopics(block, missedTopics))
		: [];
	const availableCount = allBlocks.reduce(
		(sum, block) => sum + (block.kind === 'set' ? block.children.length : 1),
		0
	);
	const targetCount = focusMode ? Math.min(requestedCount, availableCount) : requestedCount;
	const targetStimulusQuestions = stimulusTargetEnabled
		? Math.round((targetCount * policy.quizTargetQuestionPercent) / 100)
		: 0;
	const selected: IQuestion[] = [];
	let stimulusQuestionCount = 0;
	let stimulusSetCount = 0;
	let truncatedSetCount = 0;

	const fillFromBlocks = (sourceBlocks: QuizBlock[]) => {
		const remainingBlocks = [...sourceBlocks];
		while (selected.length < targetCount && remainingBlocks.length) {
			const block = chooseBlock(
				remainingBlocks,
				targetCount - selected.length,
				stimulusQuestionCount,
				targetStimulusQuestions
			);
			if (!block) break;
			const blockIndex = remainingBlocks.indexOf(block);
			remainingBlocks.splice(blockIndex, 1);
			const taken = takeFromBlock(block, targetCount - selected.length);
			selected.push(...taken);
			if (block.kind === 'set') {
				stimulusSetCount += 1;
				stimulusQuestionCount += taken.length;
				if (taken.length < block.children.length) truncatedSetCount += 1;
			}
		}
	};

	// Prefer topic-matched blocks; only then fill from the same units.
	fillFromBlocks(matchedBlocks);
	if (selected.length < targetCount) fillFromBlocks(unmatchedBlocks);

	if (selected.length === 0) {
		throw new QuizPoolWarmingError(
			focusMode
				? 'No follow-up questions are available from the missed units right now.'
				: `Not enough active questions are available for a ${requestedCount}-question quiz. Maximum available: ${availableCount}.`,
			availableCount
		);
	}

	if (!focusMode && selected.length < requestedCount) {
		throw new QuizPoolWarmingError(
			`Not enough active questions are available for a ${requestedCount}-question quiz. Maximum available: ${availableCount}.`,
			availableCount
		);
	}

	const count = selected.length;
	const focusMatchedCount = focusMode
		? countTopicMatchedQuestions(selected, missedTopics)
		: undefined;

	const stimulusTargetDeviation = stimulusQuestionCount - targetStimulusQuestions;
	logger.info('Quiz stimulus target deviation', {
		course: input.course,
		unit: input.unit,
		requestedCount: count,
		stimulusTargetQuestionCount: targetStimulusQuestions,
		stimulusQuestionCount,
		stimulusTargetDeviation
	});

	return {
		questions: selected.map(toGenerated),
		metrics: {
			requestedCount: focusMode ? requestedCount : count,
			selectedCount: selected.length,
			stimulusTargetQuestionCount: targetStimulusQuestions,
			stimulusTargetDeviation,
			stimulusQuestionCount,
			stimulusSetCount,
			discreteQuestionCount: selected.length - stimulusQuestionCount,
			truncatedSetCount,
			policyEnabled: stimulusTargetEnabled,
			globalFlagEnabled: options.globalFlagEnabled,
			...(focusMatchedCount !== undefined ? { focusMatchedCount } : {})
		}
	};
}
