import { runChatCompletion, runStreamingChat, TUTOR_MODEL } from './ai';

export interface TutorMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export async function getGreeting(question: string): Promise<string> {
	const { content } = await runChatCompletion('getGreeting', {
		model: TUTOR_MODEL,
		messages: [
			{
				role: 'system',
				content:
					'You are a friendly AP exam tutor. Greet the student and let them know you can help them understand the current question. Keep it very brief (1-2 sentences). NEVER give the answer to the question, but guide the student to think critically.'
			},
			{ role: 'user', content: `The current question is: ${question}` }
		],
		max_completion_tokens: 150
	});
	return content || "Hi! I'm here to help you understand this question.";
}

export async function* chat(opts: {
	question: string;
	correctAnswer: string;
	explanation: string;
	apClass: string;
	unit: string;
	answerChoices: { A: string; B: string; C: string; D: string } | null;
	conversationHistory: TutorMessage[];
	userMessage: string;
}): AsyncGenerator<string> {
	const {
		question,
		correctAnswer,
		explanation,
		apClass,
		unit,
		answerChoices,
		conversationHistory,
		userMessage
	} = opts;

	const choicesText = answerChoices
		? `\nAnswer Choices:\nA. ${answerChoices.A}\nB. ${answerChoices.B}\nC. ${answerChoices.C}\nD. ${answerChoices.D}`
		: '';

	const systemPrompt = `You are a helpful AP exam tutor. You're helping a student understand a specific practice question.

Course: ${apClass || 'AP Course'}
Unit: ${unit || 'N/A'}

Question: ${question}${choicesText}

Correct Answer: ${correctAnswer}
Explanation: ${explanation}

Your role:
- Help the student understand the concept behind this question
- Answer their questions clearly and concisely
- Be encouraging and supportive
- Keep responses focused on this specific question and related concepts
- Use simple, student-friendly language
- Keep responses brief (2-3 sentences max) unless the student asks for more detail

Important: do NOT at any point give the answer to the question. Instead, guide the student to think critically.`;

	yield* runStreamingChat(
		'chat',
		{
			model: TUTOR_MODEL,
			messages: [
				{ role: 'system', content: systemPrompt },
				...conversationHistory,
				{ role: 'user', content: userMessage }
			],
			max_completion_tokens: 500
		},
		{ historyLength: conversationHistory.length }
	);
}
