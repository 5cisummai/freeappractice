import { z } from 'zod';
import { listApCurriculumCourseLookupNames } from '$lib/ap-knowledge/catalog';

export const apClassSchema = z
	.enum(listApCurriculumCourseLookupNames() as [string, ...string[]])
	.describe('Canonical app-facing AP course label or supported official alias.');

const studyTaskSchema = z
	.strictObject({
		id: z
			.string()
			.trim()
			.min(1)
			.max(200)
			.describe('Stable unique ID for this task within the plan.'),
		apClass: apClassSchema.describe(
			'Course label; save using the canonical app-facing course name.'
		),
		unit: z.string().trim().min(1).max(200).describe('Full unit title for this AP course.'),
		mode: z
			.enum(['mcq', 'frq', 'review'])
			.describe(
				'Study activity: mcq for multiple choice, frq for free response, review for review.'
			),
		dayOffset: z
			.number()
			.int()
			.min(0)
			.max(6)
			.describe('Calendar-day offset from weekStart, from 0 to 6.'),
		durationMinutes: z
			.number()
			.int()
			.min(5)
			.max(30)
			.describe('Time allotted for this task, in whole minutes from 5 to 30.'),
		practiceHref: z
			.string()
			.startsWith('/app/practice')
			.max(500)
			.nullable()
			.describe('In-app practice URL beginning with /app/practice, or null when unavailable.')
	})
	.describe('One scheduled study task. Completion status is managed by the app.');

export const studyPlanToolInputSchema = z
	.strictObject({
		weekStart: z.iso
			.date()
			.describe('First local calendar date in the plan week, formatted YYYY-MM-DD.'),
		behavior: z
			.enum(['replace', 'merge'])
			.describe(
				'Replace swaps unfinished tasks with this proposal; merge adds or updates tasks and preserves other tasks.'
			),
		tasks: z
			.array(studyTaskSchema)
			.min(1)
			.max(28)
			.describe('One to 28 tasks scheduled by dayOffset from weekStart.')
	})
	.describe('Complete weekly study-plan proposal for student approval.');
