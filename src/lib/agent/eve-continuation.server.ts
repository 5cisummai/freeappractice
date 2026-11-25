import type { RequestEvent } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { InferUIMessageChunk } from 'ai';
import type { AgentUIMessage } from '#lib/agent/message.js';
import { toAgentUiMessageFromConversationRow } from '#lib/agent/conversations/messages.js';
import type { ConversationMessage } from '#lib/agent/conversations/store.server.js';
import {
	getCoachPracticeQuestionAssignment,
	getCoachPracticeQuestionToolOutput
} from '#lib/agent/tools/practice.js';
import { getCoachQuestionToolOutput } from '#lib/agent/tools/question.js';
import { createWriteTools, updateGoalsToolInputSchema } from '#lib/agent/tools/write.server.js';
import { studyPlanToolInputSchema } from '#lib/agent/plans/tool-schema.js';
import { getQuestionById } from '#lib/question-bank/mcq/repository.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { frqAttempts } from '#lib/server/neon/schema.js';

export type CoachInlineTool =
	'ask_student' | 'give_practice_question' | 'update_goals' | 'update_study_plan';

type Part = {
	type?: unknown;
	state?: unknown;
	input?: unknown;
	output?: unknown;
	toolCallId?: unknown;
};

async function validatePracticeResult(userId: string, part: Part, value: unknown) {
	const assignment = getCoachPracticeQuestionAssignment(part);
	const response = getCoachPracticeQuestionToolOutput(value);
	if (
		!assignment ||
		!response ||
		response.questionId !== assignment.questionId ||
		response.mode !== assignment.mode
	) {
		return null;
	}

	const { questionId, course, unit, mode } = assignment;
	const basics = { status: response.status, questionId, course, unit, mode };
	if (response.status === 'skipped') return basics;

	if (mode === 'mcq') {
		const selectedAnswer = response.selectedAnswer?.toUpperCase();
		if (!selectedAnswer || !/^[A-D]$/.test(selectedAnswer)) return null;
		const question = await getQuestionById(questionId);
		if (!question || (question.course && question.course !== course)) return null;
		return {
			...basics,
			selectedAnswer,
			isCorrect: selectedAnswer === question.correctAnswer.toUpperCase(),
			timeTakenMs: response.timeTakenMs
		};
	}

	const db = getNeonDatabase();
	const [attempt] = await db
		.select({
			frqPointsEarned: frqAttempts.pointsEarned,
			frqPointsAvailable: frqAttempts.pointsAvailable,
			grade: frqAttempts.grade
		})
		.from(frqAttempts)
		.where(
			and(
				eq(frqAttempts.userId, userId),
				eq(frqAttempts.questionId, questionId),
				eq(frqAttempts.status, 'graded'),
				isNull(frqAttempts.organizationId)
			)
		)
		.orderBy(desc(frqAttempts.createdAt))
		.limit(1);
	return attempt
		? {
				...basics,
				frqPointsEarned: attempt.frqPointsEarned,
				frqPointsAvailable: attempt.frqPointsAvailable,
				frqFeedback: attempt.grade?.overallFeedback
			}
		: null;
}

export async function prepareEveContinuation(input: {
	stored: ConversationMessage;
	storedPart: Part;
	submitted: Part;
	approvedMessage?: AgentUIMessage;
	event: RequestEvent;
	userId: string;
	sessionId: string;
	conversationId: string;
}): Promise<{
	message: AgentUIMessage;
	context: string;
	completedTool: CoachInlineTool;
	chunk: InferUIMessageChunk<AgentUIMessage>;
} | null> {
	const {
		stored,
		storedPart,
		submitted,
		approvedMessage,
		event,
		userId,
		sessionId,
		conversationId
	} = input;
	const message = toAgentUiMessageFromConversationRow(stored);
	const { toolCallId, type } = storedPart;
	if (!message || typeof toolCallId !== 'string' || typeof type !== 'string') return null;

	let output: unknown;
	let state: 'output-available' | 'output-denied';
	if (type === 'tool-update_goals' || type === 'tool-update_study_plan') {
		const approved = approvedMessage?.parts.find(
			(part) =>
				'toolCallId' in part &&
				part.toolCallId === toolCallId &&
				part.state === 'approval-responded'
		);
		if (!approved || !('approval' in approved) || !approved.approval) return null;
		state = approved.approval.approved ? 'output-available' : 'output-denied';
		if (state === 'output-available') {
			const tools = createWriteTools({
				locals: event.locals,
				userId,
				sessionId,
				conversationId
			});
			// Always execute the proposal from the persisted pending card.
			if (type === 'tool-update_goals') {
				const payload = updateGoalsToolInputSchema.safeParse(storedPart.input);
				if (!payload.success) return null;
				output = await tools.update_goals(payload.data);
			} else {
				const payload = studyPlanToolInputSchema.safeParse(storedPart.input);
				if (!payload.success) return null;
				output = await tools.update_study_plan(payload.data);
			}
		}
	} else if (type === 'tool-ask_student' || type === 'tool-give_practice_question') {
		if (submitted.state !== 'output-available') return null;
		state = 'output-available';
		output =
			type === 'tool-ask_student'
				? getCoachQuestionToolOutput(submitted.output)
				: await validatePracticeResult(userId, storedPart, submitted.output);
		if (!output) return null;
	} else {
		return null;
	}

	const savedOutput =
		output && typeof output === 'object' && type === 'tool-give_practice_question'
			? { ...output, prompt: getCoachPracticeQuestionAssignment(storedPart)?.prompt ?? '' }
			: output;
	const parts = message.parts.map((part) =>
		'toolCallId' in part && part.toolCallId === toolCallId
			? { ...part, state, output: savedOutput }
			: part
	) as AgentUIMessage['parts'];
	return {
		message: { ...message, parts },
		completedTool: type.slice(5) as CoachInlineTool,
		context: `Validated result from ${type.slice(5)} with input ${JSON.stringify(storedPart.input)}: ${JSON.stringify(output ?? { status: 'denied' })}`,
		chunk:
			state === 'output-denied'
				? { type: 'tool-output-denied', toolCallId }
				: { type: 'tool-output-available', toolCallId, output: savedOutput }
	};
}
