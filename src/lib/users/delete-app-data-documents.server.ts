import { deleteUserProfiles } from '$lib/users/model.server';
import { Referral } from '$lib/referrals/model.server';
import { FrqAttempt } from '$lib/frq/model.server';
import { QuestionFeedback } from '$lib/question-quality/models.server';
import {
	CoachAudit,
	InsightReport,
	StudyPlan,
	StudyPlanAudit,
	SuperBillingAccess,
	SuperGrant,
	SuperUsageRollup,
	TutorProfile
} from '$lib/super/models.server';

/**
 * Deletes app-owned rows for the given user ids (profile, FRQ attempts, referrals).
 * Does not touch Better Auth's auth tables.
 */
export async function deleteAppDataDocuments(userIds: string[]): Promise<void> {
	if (userIds.length === 0) return;

	const userIdFilter = userIds.length === 1 ? userIds[0]! : { $in: userIds };

	await Promise.all([
		deleteUserProfiles(userIds),
		TutorProfile.deleteMany({ userId: userIdFilter }),
		FrqAttempt.deleteMany({ userId: userIdFilter }),
		QuestionFeedback.deleteMany({ userId: userIdFilter }),
		SuperBillingAccess.deleteMany({ userId: userIdFilter }),
		SuperGrant.deleteMany({ userId: userIdFilter }),
		SuperUsageRollup.deleteMany({ userId: userIdFilter }),
		InsightReport.deleteMany({ userId: userIdFilter }),
		StudyPlan.deleteMany({ userId: userIdFilter }),
		StudyPlanAudit.deleteMany({ userId: userIdFilter }),
		CoachAudit.deleteMany({ userId: userIdFilter }),
		Referral.deleteMany({
			$or: [{ referrerUserId: userIdFilter }, { referredUserId: userIdFilter }]
		})
	]);
}
