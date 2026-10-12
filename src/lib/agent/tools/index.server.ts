import type { AgentToolsInput } from '$lib/agent/request';
import { inspectCoachImageTool } from '$lib/agent/attachments/images.server';
import { createReadTools } from './read.server';
import { createQuestionTools } from './questions.server';
import { createSearchTools } from './search.server';
import { createSimulationTools } from './simulation.server';
import { createWriteTools } from './write.server';

export function createAgentTools(input: AgentToolsInput) {
	return {
		inspect_coach_image: inspectCoachImageTool(input.userId, input.conversationId),
		...createReadTools(input),
		...createQuestionTools(),
		...createSearchTools(input),
		...createSimulationTools(input),
		...createWriteTools(input)
	};
}
