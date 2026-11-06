import type { StudyPlanView, StudyTask } from '#lib/agent/plans/types.js';

/** Native-safe practice destination. Do not treat web `practiceHref` as a native route. */
export type StudyTaskPracticeDestination = {
	kind: 'practice';
	course: string;
	unit: string;
	mode: StudyTask['mode'];
};

export type StudyTaskMobileView = StudyTask & {
	practiceDestination: StudyTaskPracticeDestination;
};

export type StudyPlanMobileView = Omit<StudyPlanView, 'tasks'> & {
	tasks: StudyTaskMobileView[];
};

export type StudyPlanPreview = {
	completedCount: number;
	totalCount: number;
	/** Up to three incomplete tasks ordered by date. */
	upcomingTasks: StudyTaskMobileView[];
};

export function toStudyTaskPracticeDestination(task: StudyTask): StudyTaskPracticeDestination {
	return {
		kind: 'practice',
		course: task.course,
		unit: task.unit,
		mode: task.mode
	};
}

export function toStudyTaskMobileView(task: StudyTask): StudyTaskMobileView {
	return {
		...task,
		practiceDestination: toStudyTaskPracticeDestination(task)
	};
}

export function toStudyPlanMobileView(plan: StudyPlanView): StudyPlanMobileView {
	return {
		...plan,
		tasks: plan.tasks.map(toStudyTaskMobileView)
	};
}

export function buildStudyPlanPreview(plan: StudyPlanMobileView | null): StudyPlanPreview {
	if (!plan) {
		return { completedCount: 0, totalCount: 0, upcomingTasks: [] };
	}

	const completedCount = plan.tasks.filter((task) => task.status === 'done').length;
	const upcomingTasks = [...plan.tasks]
		.filter((task) => task.status === 'todo')
		.sort((a, b) => a.date.localeCompare(b.date))
		.slice(0, 3);

	return {
		completedCount,
		totalCount: plan.tasks.length,
		upcomingTasks
	};
}
