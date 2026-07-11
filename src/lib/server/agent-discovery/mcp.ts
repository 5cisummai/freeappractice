import { absoluteUrl } from './site';
import pkg from '../../../../package.json' with { type: 'json' };

export function mcpServerInfo() {
	return {
		name: 'Free AP Practice',
		version: pkg.version
	} as const;
}

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
		tools: [
			{
				name: 'generate_question',
				description:
					'Generate an AP practice multiple-choice question for a subject and unit or custom topic.'
			},
			{
				name: 'list_subjects',
				description: 'List supported AP subjects available for practice.'
			}
		]
	};
}
