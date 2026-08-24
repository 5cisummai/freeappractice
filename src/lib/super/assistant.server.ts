import { eq } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { userProfiles } from '$lib/server/neon/schema';

/** Read the account-wide switch for Tutor and Coach. */
export async function getAssistantFeaturesEnabled(userId: string): Promise<boolean> {
	const [profile] = await getNeonDatabase()
		.select({ enabled: userProfiles.assistantFeaturesEnabled })
		.from(userProfiles)
		.where(eq(userProfiles.userId, userId))
		.limit(1);
	return profile?.enabled ?? true;
}

/** Reuse the preference lookup across every assistant decision in one request. */
export function getAssistantFeaturesEnabledForRequest(
	locals: App.Locals,
	userId: string
): Promise<boolean> {
	locals.assistantFeaturesEnabled ??= getAssistantFeaturesEnabled(userId);
	return locals.assistantFeaturesEnabled;
}

/** Persist the hidden settings action without exposing a visible control yet. */
export async function setAssistantFeaturesEnabled(userId: string, enabled: boolean): Promise<void> {
	await getNeonDatabase()
		.insert(userProfiles)
		.values({ userId, assistantFeaturesEnabled: enabled })
		.onConflictDoUpdate({
			target: userProfiles.userId,
			set: { assistantFeaturesEnabled: enabled, updatedAt: new Date() }
		});
}
