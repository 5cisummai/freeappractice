import { json } from '@sveltejs/kit';
import { getAllowedCourses, getUnitsForCourse } from '$lib/catalog/ap-courses';

const MAX_COURSE_LEN = 120;
const MAX_UNIT_LEN = 200;
const MAX_EXCLUDED_QUESTION_IDS = 100;
const MAX_QUESTION_ID_LEN = 120;

const ALLOWED_COURSES = getAllowedCourses();

interface ValidatedQuestionRequest {
	course: string;
	unit: string;
	formatId?: string;
	excludeQuestionIds: string[];
}

type QuestionRequestResult =
	{ ok: true; value: ValidatedQuestionRequest } | { ok: false; response: Response };

export function validateQuestionRequest(body: unknown): QuestionRequestResult {
	const { course, unit, formatId, customTopic, excludeQuestionIds } = (body ?? {}) as Record<
		string,
		unknown
	>;

	if (typeof course !== 'string' || !course.trim()) {
		return {
			ok: false,
			response: json(
				{ error: 'course is required and must be a non-empty string' },
				{ status: 400 }
			)
		};
	}

	const trimmedCourse = course.trim();
	if (trimmedCourse.length > MAX_COURSE_LEN) {
		return {
			ok: false,
			response: json(
				{ error: `course must be at most ${MAX_COURSE_LEN} characters` },
				{ status: 400 }
			)
		};
	}

	if (!ALLOWED_COURSES.has(trimmedCourse)) {
		return {
			ok: false,
			response: json({ error: 'course must be a supported AP course' }, { status: 400 })
		};
	}

	if (unit !== undefined && typeof unit !== 'string') {
		return {
			ok: false,
			response: json({ error: 'unit must be a string if provided' }, { status: 400 })
		};
	}

	const trimmedUnit = typeof unit === 'string' ? unit.trim() : '';
	if (formatId !== undefined && typeof formatId !== 'string') {
		return {
			ok: false,
			response: json({ error: 'formatId must be a string if provided' }, { status: 400 })
		};
	}
	const trimmedFormatId = typeof formatId === 'string' ? formatId.trim() : '';
	if (trimmedFormatId.length > 80) {
		return {
			ok: false,
			response: json({ error: 'formatId must be at most 80 characters' }, { status: 400 })
		};
	}
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
							'customTopic is deprecated; use a course unit instead. Live custom-topic generation has been removed.'
					},
					{ status: 410 }
				)
			};
		}
	}
	if (
		trimmedUnit &&
		trimmedUnit !== 'All Units' &&
		!getUnitsForCourse(trimmedCourse).includes(trimmedUnit)
	) {
		return {
			ok: false,
			response: json({ error: 'unit must be a supported course unit' }, { status: 400 })
		};
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
			course: trimmedCourse,
			unit: trimmedUnit,
			...(trimmedFormatId ? { formatId: trimmedFormatId } : {}),
			excludeQuestionIds: excludedIds
		}
	};
}
