import { inArray, or } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	coachAudits,
	frqAttempts,
	insightReports,
	questionFeedback,
	referrals,
	studyPlanAudits,
	studyPlans,
	superBillingAccess,
	superGrants,
	superUsageRollups,
	tutorProfiles
} from '$lib/server/neon/schema';
import { deleteUserProfiles } from '$lib/users/model.server';

/** Delete all application-owned rows for the supplied users. */
export async function deleteAppDataDocuments(userIds: string[]): Promise<void> {
	if (userIds.length === 0) return;

	const db = getNeonDatabase();
	await Promise.all([
		deleteUserProfiles(userIds),
		db.delete(tutorProfiles).where(inArray(tutorProfiles.userId, userIds)),
		db.delete(frqAttempts).where(inArray(frqAttempts.userId, userIds)),
		db.delete(questionFeedback).where(inArray(questionFeedback.userId, userIds)),
		db.delete(superBillingAccess).where(inArray(superBillingAccess.userId, userIds)),
		db.delete(superGrants).where(inArray(superGrants.userId, userIds)),
		db.delete(superUsageRollups).where(inArray(superUsageRollups.userId, userIds)),
		db.delete(insightReports).where(inArray(insightReports.userId, userIds)),
		db.delete(studyPlans).where(inArray(studyPlans.userId, userIds)),
		db.delete(studyPlanAudits).where(inArray(studyPlanAudits.userId, userIds)),
		db.delete(coachAudits).where(inArray(coachAudits.userId, userIds)),
		db
			.delete(referrals)
			.where(
				or(inArray(referrals.referrerUserId, userIds), inArray(referrals.referredUserId, userIds))
			)
	]);
}
