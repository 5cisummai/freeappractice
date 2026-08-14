import type { LayoutServerLoad } from './$types';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { getAssistantFeaturesEnabledForRequest } from '$lib/users/assistant-features.server';

export const load: LayoutServerLoad = async ({ request, locals }) => ({
	superFreeBetaEnabled: await isSuperFreeBetaEnabled(request),
	assistantFeaturesEnabled: locals.userId
		? await getAssistantFeaturesEnabledForRequest(locals, locals.userId)
		: true
});
