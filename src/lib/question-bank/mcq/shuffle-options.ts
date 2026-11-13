import type { ChoiceExplanations } from './enrichment.js';

export const MCQ_OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
export type McqOptionLetter = (typeof MCQ_OPTION_LETTERS)[number];

/** Persisted on MCQ JSONB so backfills stay idempotent. */
export const OPTIONS_SHUFFLED_FLAG = 'optionsShuffled' as const;

export type McqShufflableFields = {
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: McqOptionLetter;
	explanation?: string;
	choiceExplanations?: ChoiceExplanations | null;
};

function isOptionLetter(value: string): value is McqOptionLetter {
	return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

function optionText(
	input: McqShufflableFields,
	letter: McqOptionLetter
): string {
	switch (letter) {
		case 'A':
			return input.optionA;
		case 'B':
			return input.optionB;
		case 'C':
			return input.optionC;
		case 'D':
			return input.optionD;
		default: {
			const _exhaustive: never = letter;
			return _exhaustive;
		}
	}
}

/** Fisher–Yates shuffle; `random` should return values in [0, 1). */
export function shuffleLetters(
	letters: readonly McqOptionLetter[] = MCQ_OPTION_LETTERS,
	random: () => number = Math.random
): McqOptionLetter[] {
	const order = [...letters];
	for (let i = order.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		const tmp = order[i]!;
		order[i] = order[j]!;
		order[j] = tmp;
	}
	return order;
}

/**
 * Remap bare A–D tokens in explanation prose after an option permutation.
 * Uses placeholders so chained letter moves do not collide.
 */
export function remapOptionLettersInText(
	text: string,
	oldToNew: Readonly<Record<McqOptionLetter, McqOptionLetter>>
): string {
	if (!text) return text;
	return text
		.replace(/\b([A-D])\b/g, (_match, letter: string) => `__MCQ_OPT_${letter}__`)
		.replace(/__MCQ_OPT_([A-D])__/g, (_match, letter: string) =>
			isOptionLetter(letter) ? oldToNew[letter] : letter
		);
}

function remapChoiceExplanations(
	choiceExplanations: ChoiceExplanations | null | undefined,
	sourceOrder: readonly McqOptionLetter[]
): ChoiceExplanations | null | undefined {
	if (choiceExplanations == null) return choiceExplanations;
	return {
		A: choiceExplanations[sourceOrder[0]!],
		B: choiceExplanations[sourceOrder[1]!],
		C: choiceExplanations[sourceOrder[2]!],
		D: choiceExplanations[sourceOrder[3]!]
	};
}

/**
 * Permute MCQ options so the correct letter is not stuck on A.
 * `sourceOrder[i]` is the old letter whose text moves to `MCQ_OPTION_LETTERS[i]`.
 */
export function shuffleMcqOptions<T extends McqShufflableFields>(
	input: T,
	random: () => number = Math.random
): T & { [OPTIONS_SHUFFLED_FLAG]: true } {
	const sourceOrder = shuffleLetters(MCQ_OPTION_LETTERS, random);
	const oldToNew = {
		A: MCQ_OPTION_LETTERS[sourceOrder.indexOf('A')]!,
		B: MCQ_OPTION_LETTERS[sourceOrder.indexOf('B')]!,
		C: MCQ_OPTION_LETTERS[sourceOrder.indexOf('C')]!,
		D: MCQ_OPTION_LETTERS[sourceOrder.indexOf('D')]!
	} as Record<McqOptionLetter, McqOptionLetter>;

	const correctAnswer = oldToNew[input.correctAnswer];
	if (!correctAnswer) {
		throw new Error(`Invalid correctAnswer before shuffle: ${input.correctAnswer}`);
	}

	return {
		...input,
		optionA: optionText(input, sourceOrder[0]!),
		optionB: optionText(input, sourceOrder[1]!),
		optionC: optionText(input, sourceOrder[2]!),
		optionD: optionText(input, sourceOrder[3]!),
		correctAnswer,
		explanation:
			typeof input.explanation === 'string'
				? remapOptionLettersInText(input.explanation, oldToNew)
				: input.explanation,
		choiceExplanations: remapChoiceExplanations(input.choiceExplanations, sourceOrder),
		[OPTIONS_SHUFFLED_FLAG]: true
	};
}

export function hasShuffledMcqOptions(data: unknown): boolean {
	if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
	return (data as Record<string, unknown>)[OPTIONS_SHUFFLED_FLAG] === true;
}
