import { getUnitsForClass } from '$lib/catalog/ap-classes';
import {
	findActiveQuestionsForQuiz,
	storedQuestionFromPayload,
	type IQuestion
} from '$lib/question-bank/mcq/repository.server';
import { storedQuestionToGenerated } from '$lib/question-bank/mcq/public-payload.server';
import {
	getStimulusPolicy,
	isStimulusPolicyEnabledForUnit,
	type StimulusPolicy
} from '$lib/question-bank/mcq/stimulus-policy';
import type { GeneratedQuestion } from '$lib/question-bank/mcq/types';

export type QuizAssemblyInput = {
	apClass: string;
	unit?: string;
	unitRange?: readonly number[];
	count: number;
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
};

export type QuizAssemblyResult = {
	questions: GeneratedQuestion[];
	metrics: QuizAssemblyMetrics;
};

export class QuizPoolWarmingError extends Error {
	readonly code = 'POOL_WARMING';

	constructor(message = 'Question pool is warming up. Please retry shortly.') {
		super(message);
		this.name = 'QuizPoolWarmingError';
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
	apClass: string,
	unit: string | undefined,
	unitRange?: readonly number[]
): string[] {
	if (unit?.trim()) return [unit.trim()];
	const units = getUnitsForClass(apClass);
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
		const policyEnabled =
			globalFlagEnabled && isStimulusPolicyEnabledForUnit(policy, question.unit);
		if (
			policyEnabled &&
			(question.diagramSpec || question.hasDiagram) &&
			!hasAllowedDiagram(question, policy)
		)
			continue;
		const stimulusId = question.stimulusId?.trim();
		if (policyEnabled && stimulusId && hasStructuredStimulus(question)) {
			const group = byStimulus.get(stimulusId) ?? [];
			group.push(question);
			byStimulus.set(stimulusId, group);
			continue;
		}
		if (policyEnabled && hasStructuredStimulus(question)) {
			blocks.push({ kind: 'discrete', question, unit: question.unit });
			continue;
		}
		if (
			!policyEnabled &&
			(hasStructuredStimulus(question) ||
				question.hasDiagram ||
				question.diagramSpec ||
				question.stimulus?.diagramSpec)
		)
			continue;
		if (policyEnabled || (!question.hasDiagram && !question.diagramSpec)) {
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
	const start = Math.floor(Math.random() * block.children.length);
	return Array.from(
		{ length: Math.min(capacity, block.children.length) },
		(_, offset) => block.children[(start + offset) % block.children.length]!
	);
}

export async function assembleMcqQuiz(
	input: QuizAssemblyInput,
	options: { globalFlagEnabled: boolean }
): Promise<QuizAssemblyResult> {
	const count = Math.min(50, Math.max(1, Math.floor(input.count)));
	const policy = getStimulusPolicy(input.apClass);
	const units = resolveQuizUnits(input.apClass, input.unit, input.unitRange);
	const enhancedEnabled =
		options.globalFlagEnabled && units.some((unit) => isStimulusPolicyEnabledForUnit(policy, unit));
	const rows = await findActiveQuestionsForQuiz({ apClass: input.apClass, units });
	const blocks = buildBlocks(rows, options.globalFlagEnabled, policy);
	const targetStimulusQuestions = enhancedEnabled
		? Math.round((count * policy.quizTargetQuestionPercent) / 100)
		: 0;
	const remainingBlocks = [...blocks];
	const selected: IQuestion[] = [];
	let stimulusQuestionCount = 0;
	let stimulusSetCount = 0;
	let truncatedSetCount = 0;

	while (selected.length < count && remainingBlocks.length) {
		const block = chooseBlock(
			remainingBlocks,
			count - selected.length,
			stimulusQuestionCount,
			targetStimulusQuestions
		);
		if (!block) break;
		const blockIndex = remainingBlocks.indexOf(block);
		remainingBlocks.splice(blockIndex, 1);
		const taken = takeFromBlock(block, count - selected.length);
		selected.push(...taken);
		if (block.kind === 'set') {
			stimulusSetCount += 1;
			stimulusQuestionCount += taken.length;
			if (taken.length < block.children.length) truncatedSetCount += 1;
		}
	}

	if (selected.length < count) {
		throw new QuizPoolWarmingError(
			`Not enough active questions are available for a ${count}-question quiz.`
		);
	}

	return {
		questions: selected.map(toGenerated),
		metrics: {
			requestedCount: count,
			selectedCount: selected.length,
			stimulusTargetQuestionCount: targetStimulusQuestions,
			stimulusTargetDeviation: stimulusQuestionCount - targetStimulusQuestions,
			stimulusQuestionCount,
			stimulusSetCount,
			discreteQuestionCount: selected.length - stimulusQuestionCount,
			truncatedSetCount,
			policyEnabled: enhancedEnabled,
			globalFlagEnabled: options.globalFlagEnabled
		}
	};
}
