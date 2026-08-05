import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { isTutorMemoryConfigured } from '$lib/mem0/service.server';
import { getTutorProfileView, updateTutorProfile } from '$lib/super/profile.server';

const MAX_SELECTED_CLASSES = 20;
const MAX_TARGET_DATES = 20;
const MAX_TEXT_LENGTH = 100;

const targetDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'targetDate must use YYYY-MM-DD format')
	.refine((value) => {
		const date = new Date(`${value}T00:00:00.000Z`);
		return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
	}, 'targetDate must be a valid calendar date');

const profilePatchSchema = z
	.object({
		selectedApClasses: z
			.array(z.string().trim().min(1).max(MAX_TEXT_LENGTH))
			.max(MAX_SELECTED_CLASSES)
			.optional(),
		targetDates: z
			.array(
				z
					.object({
						apClass: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
						targetDate: targetDateSchema
					})
					.strict()
			)
			.max(MAX_TARGET_DATES)
			.optional(),
		studyAvailability: z.string().trim().max(500).optional(),
		teachingStyle: z.enum(['socratic', 'concise', 'step_by_step']).optional(),
		memoryEnabled: z.boolean().optional()
	})
	.partial()
	.strict();

function validationError(message: string, details?: string[]): Response {
	return json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
}

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const profile = await getTutorProfileView(userId);
		return json({
			profile,
			memory: {
				enabled: profile.memoryEnabled,
				configured: isTutorMemoryConfigured(),
				disclosureAcknowledged: Boolean(profile.memoryDisclosureSeenAt)
			}
		});
	},
	{ logLabel: 'Get Super tutor profile error', errorMessage: 'Failed to fetch Super tutor profile' }
);

export const PATCH = withAuthedHandler(
	async (event, userId) => {
		let body: unknown;
		try {
			body = await event.request.json();
		} catch {
			return validationError('Profile update must be valid JSON');
		}

		const parsed = profilePatchSchema.safeParse(body);
		if (!parsed.success) {
			return validationError(
				'Invalid Super tutor profile update',
				parsed.error.issues.map((issue) => issue.message)
			);
		}

		const profile = await updateTutorProfile(userId, parsed.data);
		return json({ profile });
	},
	{
		logLabel: 'Update Super tutor profile error',
		errorMessage: 'Failed to update Super tutor profile'
	}
);
