import { describe, expect, it } from 'vitest';
import {
	appSchema,
	authAccounts,
	authAccountsRelations,
	authRateLimits,
	authSchema,
	authSessions,
	authSessionsRelations,
	authSubscriptions,
	authUsers,
	authUsersRelations,
	authVerifications,
	betterAuthSchema,
	contentSchema,
	opsSchema,
	schema as compatibilitySchema
} from '$lib/server/neon/schema';

describe('Neon schema compatibility barrel', () => {
	it('keeps all PostgreSQL domains and Better Auth relations available', () => {
		expect(authSchema).toBeDefined();
		expect(appSchema).toBeDefined();
		expect(contentSchema).toBeDefined();
		expect(opsSchema).toBeDefined();
		expect(betterAuthSchema).toEqual({
			authUsers,
			authSessions,
			authAccounts,
			authVerifications,
			authSubscriptions,
			rateLimit: authRateLimits,
			authUsersRelations,
			authSessionsRelations,
			authAccountsRelations
		});
	});

	it('assembles the same all-domain table and view surface', () => {
		expect(Object.keys(compatibilitySchema).sort()).toEqual(
			[
				'authAccounts',
				'authRateLimits',
				'authSessions',
				'authSubscriptions',
				'authUsers',
				'authVerifications',
				'betterAuthMigrationMap',
				'bookmarks',
				'coachAudits',
				'conversationMessages',
				'conversations',
				'experimentAssignments',
				'frqAttemptCriterionGrades',
				'frqAttemptGrades',
				'frqAttempts',
				'frqMaterials',
				'frqQuestions',
				'frqRubricCriteria',
				'frqRubricLevels',
				'frqSections',
				'generationRollupSnapshots',
				'insightReports',
				'legacyDocuments',
				'mcqAttempts',
				'mcqQuestions',
				'migrationLedger',
				'migrationRejects',
				'migrationRuns',
				'migrationTransforms',
				'poolBucketWriteLocks',
				'poolGenerationBudgets',
				'poolRefillStates',
				'questionFeedback',
				'questionGenerationByClass',
				'questionGenerationByGlobalUnit',
				'questionGenerationByUnit',
				'questionQuality',
				'questionQualityAudits',
				'questionRecentTopics',
				'questionRegistry',
				'qualityReviewBatches',
				'qualityReviewJobCandidates',
				'qualityReviewJobItems',
				'qualityReviewJobs',
				'schemaMigrations',
				'seenQuestions',
				'studyPlanAudits',
				'studyPlans',
				'studyTasks',
				'superBillingAccess',
				'superCleanupJobs',
				'superGrants',
				'superUsageRollups',
				'tutorProfileClasses',
				'tutorProfiles',
				'tutorTargetDates',
				'userProfiles',
				'userProgress',
				'userSubjects',
				'referrals'
			].sort()
		);

		expect(compatibilitySchema.authUsers).toBe(authUsers);
		expect(compatibilitySchema.authSessions).toBe(authSessions);
	});
});
