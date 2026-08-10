import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Temporary: send /super to pricing until the Super landing is ready.
export const load: PageServerLoad = () => {
	throw redirect(302, '/pricing');
};
