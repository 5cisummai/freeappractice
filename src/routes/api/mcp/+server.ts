import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mcpServerInfo } from '$lib/server/agent-discovery/mcp';

export const prerender = false;

/** Minimal MCP Streamable HTTP discovery endpoint referenced by the server card. */
export const GET: RequestHandler = () => {
	return json(
		{
			protocolVersion: '2024-11-05',
			serverInfo: mcpServerInfo,
			capabilities: {
				tools: {}
			}
		},
		{
			headers: {
				'Cache-Control': 'public, max-age=300'
			}
		}
	);
};

export const POST: RequestHandler = () => {
	return json(
		{
			jsonrpc: '2.0',
			error: {
				code: -32601,
				message:
					'Interactive MCP tool calls are not supported on this endpoint. Use WebMCP tools in the browser or the REST API catalog.'
			},
			id: null
		},
		{ status: 501 }
	);
};
