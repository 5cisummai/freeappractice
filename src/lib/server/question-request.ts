import { json } from '@sveltejs/kit';
import apClassesData from '$lib/data/ap-classes.json';

const MAX_CUSTOM_TOPIC_LEN = 500;
const MAX_CLASS_NAME_LEN = 120;
const MAX_UNIT_LEN = 200;

const ALLOWED_CLASS_NAMES = new Set(
	((apClassesData as { courses?: Array<{ name: string }> }).courses ?? []).map((c) => c.name)
);

interface ValidatedQuestionRequest {
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

	const trimmedClassName = className.trim();
	if (trimmedClassName.length > MAX_CLASS_NAME_LEN) {
		return {
			ok: false,
			response: json(
				{ error: `className must be at most ${MAX_CLASS_NAME_LEN} characters` },
				{ status: 400 }
			)
		};
	}

	if (!ALLOWED_CLASS_NAMES.has(trimmedClassName)) {
		return {
			ok: false,
			response: json({ error: 'className must be a supported AP course' }, { status: 400 })
		};
	}

	if (unit !== undefined && typeof unit !== 'string') {
		return {
			ok: false,
			response: json({ error: 'unit must be a string if provided' }, { status: 400 })
		};
	}

	const trimmedUnit = typeof unit === 'string' ? unit.trim() : '';
	if (trimmedUnit.length > MAX_UNIT_LEN) {
		return {
			ok: false,
			response: json({ error: `unit must be at most ${MAX_UNIT_LEN} characters` }, { status: 400 })
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
			className: trimmedClassName,
			unit: trimmedUnit,
			customTopic: topicTrim
		}
	};
}
