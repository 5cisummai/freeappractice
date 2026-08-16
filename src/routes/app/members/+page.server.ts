import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listOrganizationMembers } from '$lib/auth/organization-queries.server';

export const load: PageServerLoad = async ({ parent }) => {
	const { activeOrganization } = await parent();
	if (!activeOrganization || activeOrganization.orgType === 'personal') {
		throw redirect(302, '/app');
	}

	return {
		members: await listOrganizationMembers(activeOrganization.id)
	};
};
