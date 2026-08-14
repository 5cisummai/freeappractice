import { findFrqQuestionById, type IFrqQuestion } from '$lib/frq/model.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { frqQuestions } from '$lib/server/neon/schema';
import {
	getAllQuestions,
	getQuestionById,
	type StoredQuestion
} from '$lib/questions/repository.server';

export type QuestionInventoryKind = 'mcq' | 'frq';

export type InventoryQuestion = {
	kind: QuestionInventoryKind;
	id: string;
	apClass: string;
	unit: string;
	createdAt: string;
	contentHash?: string;
	content: Record<string, unknown>;
};

export interface QuestionInventoryAdapter {
	kind: QuestionInventoryKind;
	list: () => Promise<InventoryQuestion[]>;
	get: (questionId: string) => Promise<InventoryQuestion>;
}

function normalizeMcq(question: StoredQuestion): InventoryQuestion {
	return {
		kind: 'mcq',
		id: question.id,
		apClass: question.apClass ?? '',
		unit: question.unit ?? '',
		createdAt: question.createdAt,
		contentHash: question.contentHash,
		content: question as unknown as Record<string, unknown>
	};
}

function normalizeFrq(question: IFrqQuestion): InventoryQuestion {
	return {
		kind: 'frq',
		id: question.questionId,
		apClass: question.apClass,
		unit: question.unit,
		createdAt: question.createdAt.toISOString(),
		contentHash: question.contentHash,
		content: question as unknown as Record<string, unknown>
	};
}

const mcqInventory: QuestionInventoryAdapter = {
	kind: 'mcq',
	list: async () => (await getAllQuestions()).map(normalizeMcq),
	get: async (questionId) => normalizeMcq(await getQuestionById(questionId))
};

const frqInventory: QuestionInventoryAdapter = {
	kind: 'frq',
	list: async () => {
		const rows = await getNeonDatabase().select().from(frqQuestions);
		return rows.map((question) =>
			normalizeFrq({
				...question,
				schemaVersion: question.schemaVersion as 1,
				materials: [],
				sections: [],
				rubric: []
			})
		);
	},
	get: async (questionId) => {
		const question = await findFrqQuestionById(questionId.trim());
		if (!question) throw new Error(`Question not found: ${questionId.trim()}`);
		return normalizeFrq(question);
	}
};

const inventories = { mcq: mcqInventory, frq: frqInventory } satisfies Record<
	QuestionInventoryKind,
	QuestionInventoryAdapter
>;

export function getQuestionInventory(kind: QuestionInventoryKind): QuestionInventoryAdapter {
	return inventories[kind];
}
