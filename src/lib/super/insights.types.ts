import type { StudyPlanView } from '$lib/super/types';

export type InsightFocusArea = {
	kind: 'focus' | 'momentum' | 'habit';
	title: string;
	detail: string;
	why: string;
	apClass: string | null;
	unit: string | null;
};

export type InsightsMetrics = {
	mcqAttempts: number;
	mcqAccuracy: number | null;
	frqSubmissions: number;
	frqAveragePercentage: number | null;
	activeDays: number;
	previousMcqAttempts: number;
	previousMcqAccuracy: number | null;
};

export type InsightsResponse = {
	generatedAt: string;
	window: {
		startsOn: string;
		endsOn: string;
		days: number;
	};
	metrics: InsightsMetrics;
	headline: string;
	summary: string;
	focusAreas: InsightFocusArea[];
	planRationale: string;
	plan: StudyPlanView | null;
	usageWarning?: 80 | 95 | null;
};
