import { absoluteUrl } from './site';
import pkg from '../../../../package.json' with { type: 'json' };

export function mcpServerInfo() {
	return {
		name: 'Free AP Practice',
		version: pkg.version
	} as const;
}

/**
 * MCP server-card for discovery. Tools listed here must match what /api/mcp
 * actually serves — today that endpoint is not implemented (POST → 501).
 */
export function buildMcpServerCard(requestUrl?: URL) {
	return {
		$schema: 'https://modelcontextprotocol.io/schemas/server-card/v1',
		serverInfo: mcpServerInfo(),
		transport: {
			type: 'streamable-http',
			endpoint: absoluteUrl('/api/mcp', requestUrl)
		},
		capabilities: {
			tools: {
				listChanged: false
			},
			resources: {},
			prompts: {}
		},
		tools: [] as { name: string; description: string }[],
		status: 'unimplemented' as const,
		documentation: absoluteUrl('/llms.txt', requestUrl)
	};
}
