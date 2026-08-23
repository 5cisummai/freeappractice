import { pruneMessages, type ModelMessage } from 'ai';

const BULKY_READ_TOOLS = [
	'generate_diagram',
	'read_course_catalog',
	'read_activity_summary',
	'read_quiz_attempt',
	'read_unit_detail'
] as const;

const STANDARD_READ_TOOLS = [
	'read_progress_summary',
	'read_frq_performance',
	'read_current_question',
	'read_profile',
	'read_study_plan'
] as const;

/** Trim tool and reasoning noise before each agent step while keeping recent tool results. */
export function pruneSuperAgentModelMessages(messages: ModelMessage[]): ModelMessage[] {
	return pruneMessages({
		messages,
		// OpenAI Responses message items can require their paired reasoning item.
		// Keep the complete reasoning history instead of pruning prior assistant parts.
		reasoning: 'none',
		toolCalls: [
			{ type: 'before-last-message', tools: [...BULKY_READ_TOOLS] },
			{ type: 'before-last-5-messages', tools: [...STANDARD_READ_TOOLS] },
			{ type: 'before-last-8-messages', tools: ['give_practice_question'] },
			{ type: 'before-last-3-messages', tools: ['update_goals', 'update_study_plan'] }
		],
		emptyMessages: 'remove'
	});
}
