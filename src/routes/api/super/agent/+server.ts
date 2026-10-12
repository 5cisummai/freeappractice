import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { handleAgentPost, agentRouteConfig } from '$lib/agent/route.server';

export const config = agentRouteConfig;

export const POST: RequestHandler = withAuthedHandler(handleAgentPost, {
	logLabel: 'Super Agent request error',
	errorMessage: 'Failed to start Super Agent'
});
