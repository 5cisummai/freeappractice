import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listOrganizationSharedSets } from '$lib/auth/organization-queries.server';

export const load: PageServerLoad = async ({ parent }) => {
	const { activeOrganization } = await parent();
	if (!activeOrganization || activeOrganization.orgType !== 'group') {
		throw redirect(302, '/app');
	}

	const materials = await listOrganizationSharedSets(activeOrganization.id);

	return {
		materials,
		canManageMaterials:
			activeOrganization.role === 'owner' || activeOrganization.role === 'admin'
	};
};
