import { json, type RequestHandler } from '@sveltejs/kit';
import { OrganizationPermissionError } from '$lib/auth/organization-types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import {
	attachSharedQuizToOrganization,
	detachSharedQuizFromOrganization,
	SharedQuizValidationError
} from '$lib/shared-practice/shared-sets.server';

function parseOrganizationIdFromBody(body: unknown): string | null {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
	const organizationId = (body as Record<string, unknown>).organizationId;
	return typeof organizationId === 'string' && organizationId.trim() ? organizationId.trim() : null;
}

function parseOrganizationIdFromQuery(event: Parameters<RequestHandler>[0]): string | null {
	const organizationId = event.url.searchParams.get('organizationId');
	return organizationId?.trim() || null;
}

export const PATCH: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const setId = event.params.id?.trim() ?? '';
		if (!setId) return json({ error: 'Shared quiz is required.' }, { status: 400 });

		const organizationId = parseOrganizationIdFromBody(
			await event.request.json().catch(() => null)
		);
		if (!organizationId) {
			return json({ error: 'Organization is required.' }, { status: 400 });
		}

		try {
			await attachSharedQuizToOrganization({ setId, organizationId, userId });
			return json({ attached: true });
		} catch (error) {
			if (error instanceof SharedQuizValidationError) {
				return json({ error: error.message }, { status: 400 });
			}
			if (error instanceof OrganizationPermissionError) {
				return json({ error: error.message }, { status: 403 });
			}
			throw error;
		}
	},
	{
		logLabel: 'Attach shared quiz to organization',
		errorMessage: 'Could not share with your group.'
	}
);

export const DELETE: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const setId = event.params.id?.trim() ?? '';
		if (!setId) return json({ error: 'Shared quiz is required.' }, { status: 400 });

		const organizationId = parseOrganizationIdFromQuery(event);
		if (!organizationId) {
			return json({ error: 'Organization is required.' }, { status: 400 });
		}

		try {
			await detachSharedQuizFromOrganization({ setId, organizationId, userId });
			return json({ removed: true });
		} catch (error) {
			if (error instanceof SharedQuizValidationError) {
				return json({ error: error.message }, { status: 400 });
			}
			if (error instanceof OrganizationPermissionError) {
				return json({ error: error.message }, { status: 403 });
			}
			throw error;
		}
	},
	{ logLabel: 'Detach shared quiz from organization', errorMessage: 'Could not remove this quiz.' }
);
