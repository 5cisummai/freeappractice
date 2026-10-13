import { tool } from 'ai';

import {
	coachPracticeQuestionToolInputSchema,
	coachPracticeQuestionToolOutputSchema
} from '#lib/agent/tools/practice.js';
import {
	coachQuestionToolInputSchema,
	coachQuestionToolOutputSchema
} from '#lib/agent/tools/question.js';

export function createQuestionTools() {
	return {
		ask_student: tool({
			description:
				'Ask the student one concise question when essential information is missing and cannot be inferred from the conversation or their saved context. The student can choose an option or write a response. Do not use for confirmation or when you can answer without asking.',
			inputSchema: coachQuestionToolInputSchema,
			outputSchema: coachQuestionToolOutputSchema
		}),
		give_practice_question: tool({
			description:
				'Get one bank question and show it inline for the student to answer or skip. The tool pauses until they respond, then returns their result in the output: MCQ selected letter and correctness, or FRQ score and feedback. Use when the student wants a problem to try. Never reveal the correct answer in your reply.',
			inputSchema: coachPracticeQuestionToolInputSchema,
			outputSchema: coachPracticeQuestionToolOutputSchema
		})
	};
}
