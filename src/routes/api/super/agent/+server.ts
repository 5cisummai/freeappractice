import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { handleSuperAgentPost, superAgentRouteConfig } from '$lib/super/agent-route.server';

export const config = superAgentRouteConfig;

export const POST: RequestHandler = withAuthedHandler(handleSuperAgentPost, {
	logLabel: 'Super Agent request error',
	errorMessage: 'Failed to start Super Agent'
});
