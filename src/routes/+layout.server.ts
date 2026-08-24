import type { LayoutServerLoad } from './$types';
import { ROOT_LAYOUT_DEPENDENCY } from '$lib/layout-dependencies';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { getAssistantFeaturesEnabledForRequest } from '$lib/super/assistant.server';

export const load: LayoutServerLoad = async ({ depends, request, locals }) => {
	depends(ROOT_LAYOUT_DEPENDENCY);

	return {
		superFreeBetaEnabled: await isSuperFreeBetaEnabled(request),
		assistantFeaturesEnabled: locals.userId
			? await getAssistantFeaturesEnabledForRequest(locals, locals.userId)
			: true
	};
};
