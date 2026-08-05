import { randomUUID } from 'node:crypto';
import { connectDb } from '$lib/server/db';
import { TutorProfile, type ITutorProfile } from '$lib/super/models.server';
import type { TutorProfileUpdate, TutorProfileView } from '$lib/super/types';

const MAX_SELECTED_CLASSES = 20;
const MAX_TARGET_DATES = 20;

function toTutorProfileView(profile: ITutorProfile): TutorProfileView {
	return {
		ageConfirmedAt: profile.ageConfirmedAt?.toISOString() ?? null,
		selectedApClasses: [...profile.selectedApClasses],
		targetDates: profile.targetDates.map((target) => ({
			apClass: target.apClass,
			targetDate: target.targetDate.toISOString().slice(0, 10)
		})),
		studyAvailability: profile.studyAvailability,
		teachingStyle: profile.teachingStyle,
		memoryEnabled: profile.memoryEnabled,
		memoryDisclosureSeenAt: profile.memoryDisclosureSeenAt?.toISOString() ?? null
	};
}

export async function ensureTutorProfile(userId: string): Promise<ITutorProfile> {
	await connectDb();
	const existing = await TutorProfile.findOne({ userId }).exec();
	if (existing) return existing;

	try {
		return await TutorProfile.create({ userId, mem0UserId: randomUUID() });
	} catch (error) {
		if (error instanceof Error && 'code' in error && (error as { code?: number }).code === 11000) {
			const concurrent = await TutorProfile.findOne({ userId }).exec();
			if (concurrent) return concurrent;
		}
		throw error;
	}
}

export async function getTutorProfileView(userId: string): Promise<TutorProfileView> {
	return toTutorProfileView(await ensureTutorProfile(userId));
}

export async function confirmAge(userId: string): Promise<TutorProfileView> {
	const profile = await ensureTutorProfile(userId);
	if (!profile.ageConfirmedAt) {
		profile.ageConfirmedAt = new Date();
		await profile.save();
	}
	return toTutorProfileView(profile);
}

export async function markMemoryDisclosureSeen(userId: string): Promise<void> {
	const profile = await ensureTutorProfile(userId);
	if (!profile.memoryDisclosureSeenAt) {
		profile.memoryDisclosureSeenAt = new Date();
		await profile.save();
	}
}

export async function updateTutorProfile(
	userId: string,
	patch: TutorProfileUpdate
): Promise<TutorProfileView> {
	const profile = await ensureTutorProfile(userId);

	if (patch.selectedApClasses !== undefined) {
		profile.selectedApClasses = [...new Set(patch.selectedApClasses.map((value) => value.trim()))]
			.filter(Boolean)
			.slice(0, MAX_SELECTED_CLASSES);
	}
	if (patch.targetDates !== undefined) {
		profile.targetDates = patch.targetDates
			.map((target) => ({
				apClass: target.apClass.trim(),
				targetDate: new Date(target.targetDate)
			}))
			.filter((target) => target.apClass && Number.isFinite(target.targetDate.getTime()))
			.slice(0, MAX_TARGET_DATES);
	}
	if (patch.studyAvailability !== undefined) {
		profile.studyAvailability = patch.studyAvailability.trim().slice(0, 500);
	}
	if (patch.teachingStyle !== undefined) profile.teachingStyle = patch.teachingStyle;
	if (patch.memoryEnabled !== undefined) profile.memoryEnabled = patch.memoryEnabled;

	await profile.save();
	return toTutorProfileView(profile);
}

export async function getMem0UserId(userId: string): Promise<string> {
	return (await ensureTutorProfile(userId)).mem0UserId;
}
