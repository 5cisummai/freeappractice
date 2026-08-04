/** Typed generation error used by background question workers. */

export class QuestionGenerationError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'QuestionGenerationError';
	}
}
