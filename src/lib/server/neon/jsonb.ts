import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

export type QuestionPayloadTextField = 'course' | 'unit' | 'topicsCovered';

/** Build one of the indexed text expressions stored in a question JSONB payload. */
export function questionPayloadTextField(
	data: SQLWrapper,
	field: QuestionPayloadTextField
): SQL<string> {
	switch (field) {
		case 'course':
			return sql<string>`${data} ->> 'course'`;
		case 'unit':
			return sql<string>`${data} ->> 'unit'`;
		case 'topicsCovered':
			return sql<string>`${data} ->> 'topicsCovered'`;
		default: {
			const _exhaustive: never = field;
			return _exhaustive;
		}
	}
}

/** Indexed course/unit expressions used by pool queries. */
export function questionBucketFields(data: SQLWrapper): {
	course: SQL<string>;
	unit: SQL<string>;
} {
	return {
		course: questionPayloadTextField(data, 'course'),
		unit: questionPayloadTextField(data, 'unit')
	};
}
