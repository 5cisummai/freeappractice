import { absoluteUrl } from './site';
import pkg from '../../../../package.json' with { type: 'json' };

export const mcpServerInfo = {
	name: 'Free AP Practice',
	version: pkg.version
} as const;

/** MCP server-card for discovery. Interactive tool calls return POST 501. */
export function buildMcpServerCard(requestUrl?: URL) {
	return {
		$schema: 'https://modelcontextprotocol.io/schemas/server-card/v1',
		serverInfo: mcpServerInfo,
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
		tools: [],
		status: 'unimplemented' as const,
		documentation: absoluteUrl('/llms.txt', requestUrl)
	};
}
