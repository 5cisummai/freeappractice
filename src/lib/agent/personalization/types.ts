export type TutorTeachingStyle = 'socratic' | 'concise' | 'step_by_step';

export type TutorTargetDate = {
	course: string;
	targetDate: string;
};

export type TutorProfileView = {
	ageConfirmedAt: string | null;
	selectedApClasses: string[];
	targetDates: TutorTargetDate[];
	studyAvailability: string;
	teachingStyle: TutorTeachingStyle;
	memoryEnabled: boolean;
	memoryDisclosureSeenAt: string | null;
};

export type TutorProfileUpdate = Partial<
	Pick<
		TutorProfileView,
		'selectedApClasses' | 'targetDates' | 'studyAvailability' | 'teachingStyle' | 'memoryEnabled'
	>
>;
