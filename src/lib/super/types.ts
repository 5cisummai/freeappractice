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

export const PAID_PLAN_PERMISSIONS = {
	super: {
		personalizedTutor: true,
		coach: true,
		studyPlans: true,
		memory: true
	}
} as const;

export type PaidCapability = keyof (typeof PAID_PLAN_PERMISSIONS)['super'];

export type PlanAccess = {
	plan: Plan;
	accessReason: SuperAccessReason;
};

/** Return whether a paid capability is available under the resolved plan. */
export function hasPaidCapability(access: PlanAccess, capability: PaidCapability): boolean {
	return access.plan === 'super' && PAID_PLAN_PERMISSIONS.super[capability];
}

export const FREE_PLAN_ACCESS: PlanAccess = {
	plan: 'free',
	accessReason: null
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

export type StudyPlanInsights = {
	generatedAt: string;
	window: {
		startsOn: string;
		endsOn: string;
		days: number;
	};
	metrics: {
		mcqAttempts: number;
		mcqAccuracy: number | null;
		frqSubmissions: number;
		frqAveragePercentage: number | null;
		activeDays: number;
		previousMcqAttempts: number;
		previousMcqAccuracy: number | null;
	};
	headline: string;
	summary: string;
	focusAreas: Array<{
		kind: 'focus' | 'momentum' | 'habit';
		title: string;
		detail: string;
		why: string;
		apClass: string | null;
		unit: string | null;
	}>;
	planRationale: string;
};

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
	insights?: StudyPlanInsights;
	updatedAt: string;
};

export const INDEFINITE_SUPER_GRANT_EXPIRES_AT = '9999-12-31T23:59:59.000Z';

export function isIndefiniteSuperGrantExpiry(expiresAt: string): boolean {
	return new Date(expiresAt).getUTCFullYear() >= 9999;
}

export type SuperGrantView = {
	id: string;
	userId: string;
	startsAt: string;
	expiresAt: string;
	reason: string;
	createdBy: string;
	createdAt: string;
};

export type SuperSubscriptionView = {
	id: string;
	userId: string;
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
	status: string;
	periodStart: string | null;
	periodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	cancelAt: string | null;
	pastDueSince: string | null;
	superEndedAt: string | null;
	accessReason: SuperAccessReason;
};

export type SuperCleanupJobKind = 'account_delete' | 'downgrade_purge';

export type SuperCleanupJobView = {
	id: string;
	userId: string;
	kind: SuperCleanupJobKind;
	attempts: number;
	nextAttemptAt: string;
	lastError: string;
	createdAt: string;
	updatedAt: string;
};

export type SuperAdminOverview = {
	activeSubscriptions: number;
	pastDueSubscriptions: number;
	activeGrants: number;
	month: string;
	personalizedMessagesThisMonth: number;
	subscriptions: SuperSubscriptionView[];
	failedCleanupJobs: SuperCleanupJobView[];
};
