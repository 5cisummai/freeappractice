import type { LayoutServerLoad } from './$types';
import { isSuperFreeBetaEnabled } from '$lib/flags';

export const load: LayoutServerLoad = async ({ request }) => ({
	superFreeBetaEnabled: await isSuperFreeBetaEnabled(request)
});
