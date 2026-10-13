import type { LayoutServerLoad } from './$types';
import { ROOT_LAYOUT_DEPENDENCY } from '#lib/layout-dependencies.js';
import { isSuperFreeBetaEnabled } from '#lib/flags.js';
import { getAssistantFeaturesEnabledForRequest } from '#lib/users/assistant-preferences.server.js';

export const load: LayoutServerLoad = async ({ depends, request, locals }) => {
	depends(ROOT_LAYOUT_DEPENDENCY);

	return {
		userId: locals.userId ?? null,
		superFreeBetaEnabled: await isSuperFreeBetaEnabled(request),
		assistantFeaturesEnabled: locals.userId
			? await getAssistantFeaturesEnabledForRequest(locals, locals.userId)
			: true
	};
};
