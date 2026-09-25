import { AP_DATA } from '$lib/data/ap-data';
import { getUnitsForCourse, resolveEffectiveUnit } from '$lib/catalog/ap-courses';

export const FRQ_ALL_UNITS = 'All Units';

export type FrqControl = 'task' | 'unit';

export type FrqScope = 'none' | 'multi-unit' | 'period' | 'single-unit' | 'anchor';

/** One sentence per scope. The generator adds this and nothing else about units. */
export const FRQ_SCOPE_SENTENCE: Record<FrqScope, string> = {
	none: '',
	'multi-unit': 'Use at least two units. None is required.',
	period: 'Follow this format’s period rule. No unit is required.',
	'single-unit': 'Stay inside this unit.',
	anchor: 'Anchor to this unit. Earlier-unit tools only in service of the anchor.'
};

export type FrqTaskOption = {
	formatId: string;
	label: string;
};

export type FrqPractice = {
	control: FrqControl;
	scope: FrqScope;
	tasks: FrqTaskOption[];
};

const CONTROLS = new Set<FrqControl>(['task', 'unit']);
const SCOPES = new Set<FrqScope>(['none', 'multi-unit', 'period', 'single-unit', 'anchor']);

function isControl(value: string): value is FrqControl {
	return CONTROLS.has(value as FrqControl);
}

function isScope(value: string): value is FrqScope {
	return SCOPES.has(value as FrqScope);
}

function examFormatIds(course: (typeof AP_DATA.courses)[number]): string[] {
	return course.official.exam.sections.flatMap((section) =>
		section.id !== 'multiple-choice' && 'questionTypes' in section ? section.questionTypes : []
	);
}

/** Course control and scope live next to the format records. Absent when the course has no FRQ profile. */
export function frqPracticeFor(courseName: string): FrqPractice | null {
	const course = AP_DATA.courses.find((item) => item.name === courseName);
	const frq = course?.generation.frq;
	if (
		!course ||
		!frq ||
		!('control' in frq) ||
		typeof frq.control !== 'string' ||
		!('scope' in frq) ||
		typeof frq.scope !== 'string' ||
		!('formats' in frq)
	)
		return null;
	if (!isControl(frq.control) || !isScope(frq.scope)) return null;
	const labels = ('taskLabels' in frq ? frq.taskLabels : undefined) ?? {};
	const tasks = examFormatIds(course).map((formatId) => {
		const label = labels[formatId as keyof typeof labels] ?? formatId;
		return { formatId, label };
	});
	return { control: frq.control, scope: frq.scope, tasks };
}

export class UnknownFrqTaskError extends Error {
	constructor(formatId: string) {
		super(`Unknown FRQ task ${formatId}`);
		this.name = 'UnknownFrqTaskError';
	}
}

export type FrqPoolRequest = {
	storedUnit: string;
	poolUnit: string;
	formatId?: string;
};

/**
 * Task courses store All Units and pool by format id.
 * Unit courses keep the unit bucket. An empty selection becomes one catalog unit.
 */
export function resolveFrqPoolRequest(
	course: string,
	unit: string,
	formatId?: string
): FrqPoolRequest {
	const practice = frqPracticeFor(course);
	if (!practice) throw new Error('FRQ practice is not available for this course');
	if (practice.control === 'task') {
		const requested = formatId?.trim() ?? '';
		if (requested && !practice.tasks.some((task) => task.formatId === requested)) {
			throw new UnknownFrqTaskError(requested);
		}
		const fromUnit = practice.tasks.find((task) => task.formatId === unit.trim());
		const chosen =
			practice.tasks.find((task) => task.formatId === requested) ??
			fromUnit ??
			practice.tasks[Math.floor(Math.random() * practice.tasks.length)];
		if (!chosen) throw new Error('FRQ practice is not available for this course');
		return { storedUnit: FRQ_ALL_UNITS, poolUnit: chosen.formatId, formatId: chosen.formatId };
	}
	const trimmed = unit.trim();
	const storedUnit =
		trimmed && trimmed !== FRQ_ALL_UNITS ? trimmed : resolveEffectiveUnit(course, '');
	return {
		storedUnit,
		poolUnit: storedUnit,
		formatId: formatId?.trim() || undefined
	};
}

/** Pool lookups for a task course read All Units plus the format id stored in the bucket key. */
export function frqStoredPoolFilter(
	course: string,
	poolUnit: string
): { unit: string; formatId?: string } {
	const practice = frqPracticeFor(course);
	if (practice?.control === 'task') return { unit: FRQ_ALL_UNITS, formatId: poolUnit };
	return { unit: poolUnit };
}

/** Task courses have one bucket per format. Unit courses keep one bucket per catalog unit. */
export function frqBucketUnits(course: string): string[] {
	const practice = frqPracticeFor(course);
	if (!practice) return [];
	if (practice.control === 'task') return practice.tasks.map((task) => task.formatId);
	return getUnitsForCourse(course);
}
