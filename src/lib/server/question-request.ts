import { json } from '@sveltejs/kit';

const MAX_CUSTOM_TOPIC_LEN = 500;

export interface ValidatedQuestionRequest {
	className: string;
	unit: string;
	customTopic: string;
}

export type QuestionRequestResult =
	| { ok: true; value: ValidatedQuestionRequest }
	| { ok: false; response: Response };

export function validateQuestionRequest(body: unknown): QuestionRequestResult {
	const { className, unit, customTopic } = (body ?? {}) as Record<string, unknown>;

	if (typeof className !== 'string' || !className.trim()) {
		return {
			ok: false,
			response: json(
				{ error: 'className is required and must be a non-empty string' },
				{ status: 400 }
			)
		};
	}
	if (unit !== undefined && typeof unit !== 'string') {
		return {
			ok: false,
			response: json({ error: 'unit must be a string if provided' }, { status: 400 })
		};
	}
	if (customTopic !== undefined && typeof customTopic !== 'string') {
		return {
			ok: false,
			response: json({ error: 'customTopic must be a string if provided' }, { status: 400 })
		};
	}

	const topicTrim = typeof customTopic === 'string' ? customTopic.trim() : '';
	if (topicTrim.length > MAX_CUSTOM_TOPIC_LEN) {
		return {
			ok: false,
			response: json(
				{ error: `customTopic must be at most ${MAX_CUSTOM_TOPIC_LEN} characters` },
				{ status: 400 }
			)
		};
	}

	return {
		ok: true,
		value: {
			className: className.trim(),
			unit: typeof unit === 'string' ? unit : '',
			customTopic: topicTrim
		}
	};
}
