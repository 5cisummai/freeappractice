import type { PageServerLoad } from './$types';
import { buildHomepageLinkHeader } from '$lib/server/agent-discovery/link-headers';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({
		Link: buildHomepageLinkHeader()
	});

	return {};
};
