export const SUPER_MONTHLY_MESSAGE_LIMIT = 600;
export const SUPER_FREE_BETA_MONTHLY_MESSAGE_LIMIT = 300;
export const SUPER_PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export type Plan = 'free' | 'super';

export const SUPER_BILLING_STATUSES = [
	'active',
	'trialing',
	'past_due',
	'canceled',
	'incomplete',
	'incomplete_expired',
	'unpaid',
	'paused'
] as const;

export type SuperBillingStatus = (typeof SUPER_BILLING_STATUSES)[number];

export function isSuperBillingStatus(value: string): value is SuperBillingStatus {
	return (SUPER_BILLING_STATUSES as readonly string[]).includes(value);
}

export type SuperBillingIssue =
	'payment_failed' | 'payment_action_required' | 'invoice_finalization_failed';

export type SuperAccessReason =
	'subscription' | 'past_due_grace' | 'admin_grant' | 'free_beta' | null;

export type Entitlements = {
	plan: Plan;
	accessReason: SuperAccessReason;
	personalizedTutor: boolean;
	coach: boolean;
	aiInsights: boolean;
	studyPlans: boolean;
};

export const FREE_ENTITLEMENTS: Entitlements = {
	plan: 'free',
	accessReason: null,
	personalizedTutor: false,
	coach: false,
	aiInsights: false,
	studyPlans: false
};

export type TutorTeachingStyle = 'socratic' | 'concise' | 'step_by_step';

export type TutorTargetDate = {
	apClass: string;
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

export type StudyTaskStatus = 'todo' | 'done';

export type StudyTask = {
	id: string;
	apClass: string;
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

export type InsightFeedback = 'helpful' | 'not_helpful';
