export type SubjectCalculator = 'none' | 'scientific' | 'graphing';

/** Calculator tool type by canonical course name (matches College Board exam policy). */
const CALCULATOR_BY_COURSE: Record<string, SubjectCalculator> = {
	'AP Biology': 'scientific',
	'AP Chemistry': 'scientific',
	'AP Physics 1': 'scientific',
	'AP Physics 2': 'scientific',
	'AP Physics C: Mechanics': 'scientific',
	'AP Physics C: E&M': 'scientific',
	'AP Environmental Science': 'scientific',
	'AP Calculus AB': 'graphing',
	'AP Calculus BC': 'graphing',
	'AP Statistics': 'graphing',
	'AP Precalculus': 'graphing'
};

export function getSubjectCalculator(course: string): SubjectCalculator {
	return CALCULATOR_BY_COURSE[course] ?? 'none';
}
