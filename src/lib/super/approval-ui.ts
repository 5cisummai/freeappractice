import type {
	ToolUIPartApproval,
	ToolUIPartState
} from '$lib/components/ai-elements/confirmation/confirmation-context.svelte.js';

export type ApprovalToolPart = {
	type?: string;
	state?: string;
	input?: unknown;
	approval?: ToolUIPartApproval;
};

export type ApprovalProposal = {
	approvalId: string;
	approval: ToolUIPartApproval;
	state: ToolUIPartState;
	category: 'goals' | 'study_plans';
	proposed: unknown;
};

export function isConfirmationState(state: string | undefined): state is ToolUIPartState {
	return (
		state === 'approval-requested' ||
		state === 'approval-responded' ||
		state === 'output-denied' ||
		state === 'output-available'
	);
}

export function getApprovalProposal(part: ApprovalToolPart): ApprovalProposal | null {
	if (!part.approval?.id || !isConfirmationState(part.state)) return null;
	const category =
		part.type === 'tool-update_goals'
			? 'goals'
			: part.type === 'tool-update_study_plan'
				? 'study_plans'
				: null;
	if (!category || !part.input || typeof part.input !== 'object') return null;
	return {
		approvalId: part.approval.id,
		approval: part.approval,
		state: part.state,
		category,
		proposed: part.input
	};
}

export function approvalProposalLabel(proposal: ApprovalProposal): string {
	if (proposal.category === 'goals') return 'Approve goal changes';
	const proposed =
		proposal.proposed && typeof proposal.proposed === 'object' && !Array.isArray(proposal.proposed)
			? (proposal.proposed as Record<string, unknown>)
			: {};
	const tasks = Array.isArray(proposed.tasks) ? proposed.tasks.length : 0;
	return tasks
		? `Approve ${tasks} study-plan task${tasks === 1 ? '' : 's'}`
		: 'Approve study-plan changes';
}
