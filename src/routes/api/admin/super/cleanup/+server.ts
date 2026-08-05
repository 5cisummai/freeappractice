import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { isAdminUser } from '$lib/auth/admin.server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { retrySuperCleanupJob } from '$lib/super/admin.server';

const retrySchema = z.object({ jobId: z.string().trim().min(1).max(100) }).strict();

function requireAdmin(user: { id: string }): Response | null {
	return isAdminUser(user) ? null : json({ error: 'Admin access required' }, { status: 403 });
}

export const POST: RequestHandler = withAuthedHandler(
	async (event) => {
		const denial = requireAdmin(event.locals.user!);
		if (denial) return denial;
		const parsed = retrySchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return json({ error: 'Invalid cleanup job' }, { status: 400 });
		const retried = await retrySuperCleanupJob(parsed.data.jobId);
		return retried
			? json({ retried: true })
			: json({ error: 'Failed cleanup job not found' }, { status: 404 });
	},
	{ logLabel: 'Retry Super cleanup job error', errorMessage: 'Failed to retry Super cleanup job' }
);
