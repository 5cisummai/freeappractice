import type { StudyPlanInsights, StudyPlanView } from '$lib/super/types';

export type InsightFocusArea = StudyPlanInsights['focusAreas'][number];
export type InsightsMetrics = StudyPlanInsights['metrics'];

export type InsightsResponse = StudyPlanInsights & {
	plan: StudyPlanView | null;
	usageWarning?: 80 | 95 | null;
};
