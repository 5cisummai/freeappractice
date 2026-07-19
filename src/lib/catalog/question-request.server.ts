import { json } from '@sveltejs/kit';
import { getAllowedClassNames } from '$lib/catalog/ap-classes';

const MAX_CLASS_NAME_LEN = 120;
const MAX_UNIT_LEN = 200;
const MAX_EXCLUDED_QUESTION_IDS = 100;
const MAX_QUESTION_ID_LEN = 120;

const ALLOWED_CLASS_NAMES = getAllowedClassNames();

interface ValidatedQuestionRequest {
	className: string;
	unit: string;
	excludeQuestionIds: string[];
}

type QuestionRequestResult =
	{ ok: true; value: ValidatedQuestionRequest } | { ok: false; response: Response };

export function validateQuestionRequest(body: unknown): QuestionRequestResult {
	const { className, unit, customTopic, excludeQuestionIds } = (body ?? {}) as Record<
		string,
		unknown
	>;

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

	if (customTopic !== undefined && customTopic !== null) {
		if (typeof customTopic !== 'string') {
			return {
				ok: false,
				response: json({ error: 'customTopic must be a string if provided' }, { status: 400 })
			};
		}
		if (customTopic.trim()) {
			return {
				ok: false,
				response: json(
					{
						error:
							'customTopic is deprecated; use a class unit instead. Live custom-topic generation has been removed.'
					},
					{ status: 410 }
				)
			};
		}
	}

	if (excludeQuestionIds !== undefined && !Array.isArray(excludeQuestionIds)) {
		return {
			ok: false,
			response: json({ error: 'excludeQuestionIds must be an array if provided' }, { status: 400 })
		};
	}

	const excludedIds: string[] = [];
	for (const id of excludeQuestionIds ?? []) {
		if (typeof id !== 'string') {
			return {
				ok: false,
				response: json({ error: 'excludeQuestionIds must contain only strings' }, { status: 400 })
			};
		}
		const trimmed = id.trim();
		if (!trimmed) continue;
		if (trimmed.length > MAX_QUESTION_ID_LEN) {
			return {
				ok: false,
				response: json(
					{ error: `question IDs must be at most ${MAX_QUESTION_ID_LEN} characters` },
					{ status: 400 }
				)
			};
		}
		if (!excludedIds.includes(trimmed)) excludedIds.push(trimmed);
		if (excludedIds.length >= MAX_EXCLUDED_QUESTION_IDS) break;
	}

	return {
		ok: true,
		value: {
			className: trimmedClassName,
			unit: trimmedUnit,
			excludeQuestionIds: excludedIds
		}
	};
}
