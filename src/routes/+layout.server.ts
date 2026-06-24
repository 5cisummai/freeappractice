import { customTopicEnabled } from '$lib/flags';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	return {
		customTopicEnabled: await customTopicEnabled()
	};
};
