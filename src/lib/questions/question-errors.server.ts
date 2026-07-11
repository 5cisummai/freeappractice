/** Typed errors for POST /api/question so metrics classify without message regex. */

export class QuestionBusyError extends Error {
	constructor(message = 'Question generation is busy. Please retry in a moment.') {
		super(message);
		this.name = 'QuestionBusyError';
	}
}

export class QuestionGenerationError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'QuestionGenerationError';
	}
}
