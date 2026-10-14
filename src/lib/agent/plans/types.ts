export type StudyTaskStatus = 'todo' | 'done';

export type StudyTask = {
	id: string;
	course: string;
	unit: string;
	mode: 'mcq' | 'frq' | 'review';
	date: string;
	durationMinutes: number;
	status: StudyTaskStatus;
	practiceHref?: string;
};

export type StudyPlanView = {
	id: string;
	startsOn: string;
	tasks: StudyTask[];
	updatedAt: string;
};
