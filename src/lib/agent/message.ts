import type { UIMessage } from 'ai';
import type {
	CoachPracticeQuestionToolInput,
	CoachPracticeQuestionToolOutput
} from '#lib/agent/tools/practice.js';
import type { CoachQuestionToolInput, CoachQuestionToolOutput } from '#lib/agent/tools/question.js';

type CoachMessageData = {
	'coach-reply': { targetId: string };
	'coach-reaction': { targetId: string; emoji: '❤️' | '👍' | '👎' | '😂' | '🎉' };
};

type CoachToolParts = Record<string, { input: unknown; output: unknown }> & {
	ask_student: { input: CoachQuestionToolInput; output: CoachQuestionToolOutput };
	give_practice_question: {
		input: CoachPracticeQuestionToolInput;
		output: CoachPracticeQuestionToolOutput;
	};
};

export type AgentUIMessage = UIMessage<unknown, CoachMessageData, CoachToolParts>;
