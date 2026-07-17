import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = () => {
	if (!dev) {
		error(404, 'Not found');
	}
};
