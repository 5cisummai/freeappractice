import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getGroupMembers } from '#lib/auth/group-views.server.js';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { activeOrganization } = await parent();
	if (!activeOrganization || activeOrganization.orgType !== 'group') {
		throw redirect(302, '/app');
	}

	return { members: await getGroupMembers(locals.userId!, activeOrganization.id) };
};
