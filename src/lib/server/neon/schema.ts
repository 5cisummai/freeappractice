export * from './schema/auth';
export * from './schema/app';
export * from './schema/content';
export * from './schema/ops';

import * as app from './schema/app';
import * as auth from './schema/auth';
import * as content from './schema/content';
import * as ops from './schema/ops';

/**
 * Compatibility object for Drizzle and existing callers.
 *
 * Domain modules own table initialization; this barrel is the only place that
 * assembles the legacy all-domain schema object.
 */
export const schema = {
	authUsers: auth.authUsers,
	authSessions: auth.authSessions,
	authAccounts: auth.authAccounts,
	authVerifications: auth.authVerifications,
	authSubscriptions: auth.authSubscriptions,
	authRateLimits: auth.authRateLimits,
	userProfiles: app.userProfiles,
	userSubjects: app.userSubjects,
	mcqAttempts: app.mcqAttempts,
	userProgress: app.userProgress,
	bookmarks: app.bookmarks,
	experimentAssignments: app.experimentAssignments,
	referrals: app.referrals,
	frqAttempts: app.frqAttempts,
	frqAttemptGrades: app.frqAttemptGrades,
	frqAttemptCriterionGrades: app.frqAttemptCriterionGrades,
	tutorProfiles: app.tutorProfiles,
	tutorProfileClasses: app.tutorProfileClasses,
	tutorTargetDates: app.tutorTargetDates,
	superBillingAccess: app.superBillingAccess,
	superGrants: app.superGrants,
	superUsageRollups: app.superUsageRollups,
	insightReports: app.insightReports,
	studyPlans: app.studyPlans,
	studyTasks: app.studyTasks,
	studyPlanAudits: app.studyPlanAudits,
	coachAudits: app.coachAudits,
	conversations: app.conversations,
	conversationMessages: app.conversationMessages,
	seenQuestions: app.seenQuestions,
	questionRegistry: content.questionRegistry,
	mcqQuestions: content.mcqQuestions,
	frqQuestions: content.frqQuestions,
	frqMaterials: content.frqMaterials,
	frqSections: content.frqSections,
	frqRubricCriteria: content.frqRubricCriteria,
	frqRubricLevels: content.frqRubricLevels,
	questionRecentTopics: content.questionRecentTopics,
	questionGenerationByClass: content.questionGenerationByClass,
	questionGenerationByUnit: content.questionGenerationByUnit,
	questionGenerationByGlobalUnit: content.questionGenerationByGlobalUnit,
	questionQuality: content.questionQuality,
	questionQualityAudits: content.questionQualityAudits,
	questionFeedback: content.questionFeedback,
	qualityReviewJobs: content.qualityReviewJobs,
	qualityReviewJobCandidates: content.qualityReviewJobCandidates,
	qualityReviewJobItems: content.qualityReviewJobItems,
	qualityReviewBatches: content.qualityReviewBatches,
	poolRefillStates: ops.poolRefillStates,
	poolBucketWriteLocks: ops.poolBucketWriteLocks,
	poolGenerationBudgets: ops.poolGenerationBudgets,
	generationRollupSnapshots: ops.generationRollupSnapshots,
	superCleanupJobs: ops.superCleanupJobs,
	migrationRuns: ops.migrationRuns,
	betterAuthMigrationMap: ops.betterAuthMigrationMap,
	legacyDocuments: ops.legacyDocuments,
	migrationTransforms: ops.migrationTransforms,
	schemaMigrations: ops.schemaMigrations,
	migrationLedger: ops.migrationLedger,
	migrationRejects: ops.migrationRejects
};

export const betterAuthSchema = {
	authUsers: auth.authUsers,
	authSessions: auth.authSessions,
	authAccounts: auth.authAccounts,
	authVerifications: auth.authVerifications,
	authSubscriptions: auth.authSubscriptions,
	rateLimit: auth.authRateLimits,
	authUsersRelations: auth.authUsersRelations,
	authSessionsRelations: auth.authSessionsRelations,
	authAccountsRelations: auth.authAccountsRelations
};
