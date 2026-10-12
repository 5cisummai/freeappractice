<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	import * as Confirmation from '$lib/components/ai-elements/confirmation/index.js';

	import { type ApprovalProposal } from '$lib/components/agent/approval';

	let {
		pendingCoachApproval,
		approving,
		respondToApproval,
		motionMs
	}: {
		pendingCoachApproval: ApprovalProposal;
		approving: boolean;
		respondToApproval: (id: string, approved: boolean) => Promise<void>;
		motionMs: number;
	} = $props();
	type ApprovalSummary = { title: string; lines: string[] };
	function asRecord(value: unknown): Record<string, unknown> {
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	}

	function formatDate(value: unknown): string | null {
		if (typeof value !== 'string') return null;
		const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
			? new Date(`${value}T12:00:00`)
			: new Date(value);
		if (Number.isNaN(date.getTime())) return null;
		return date.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatStudyTask(value: unknown, weekStart: unknown): string | null {
		const task = asRecord(value);
		let taskDate = task.date;
		if (
			typeof weekStart === 'string' &&
			/^\d{4}-\d{2}-\d{2}$/.test(weekStart) &&
			typeof task.dayOffset === 'number' &&
			Number.isInteger(task.dayOffset) &&
			task.dayOffset >= 0 &&
			task.dayOffset <= 6
		) {
			const [year, month, day] = weekStart.split('-').map(Number);
			taskDate = new Date(Date.UTC(year, month - 1, day + task.dayOffset))
				.toISOString()
				.slice(0, 10);
		}
		const pieces = [
			formatDate(taskDate),
			typeof task.course === 'string' ? task.course : null,
			typeof task.unit === 'string' ? task.unit : null,
			typeof task.durationMinutes === 'number' ? `${task.durationMinutes} min` : null
		].filter((piece): piece is string => Boolean(piece));
		return pieces.length ? pieces.join(' · ') : null;
	}

	function getApprovalSummary(approval: ApprovalProposal): ApprovalSummary {
		const proposed = asRecord(approval.proposed);
		if (approval.category === 'goals') {
			const lines: string[] = [];
			if (Array.isArray(proposed.selectedApClasses)) {
				const classes = proposed.selectedApClasses.filter(
					(value): value is string => typeof value === 'string'
				);
				if (classes.length) lines.push(`Courses: ${classes.join(', ')}`);
			}
			if (Array.isArray(proposed.targetDates)) {
				for (const target of proposed.targetDates.slice(0, 3)) {
					const item = asRecord(target);
					const course = typeof item.course === 'string' ? item.course : 'AP course';
					const date = formatDate(item.targetDate);
					lines.push(date ? `${course} target: ${date}` : `${course} target date`);
				}
			}
			if (typeof proposed.studyAvailability === 'string' && proposed.studyAvailability.trim()) {
				lines.push(`Availability: ${proposed.studyAvailability.trim()}`);
			}
			return {
				title: 'Update your goals',
				lines: lines.length ? lines : ['Review the proposed changes to your goals.']
			};
		}

		const tasks = Array.isArray(proposed.tasks)
			? proposed.tasks
					.map((task) => formatStudyTask(task, proposed.weekStart))
					.filter((task): task is string => Boolean(task))
			: [];
		const lines = tasks.slice(0, 4);
		if (tasks.length > 4) lines.push(`Plus ${tasks.length - 4} more study sessions`);
		return {
			title: 'Update your study plan',
			lines: lines.length ? lines : ['Review the proposed changes to your study plan.']
		};
	}
</script>

{#if pendingCoachApproval}
	{@const summary = getApprovalSummary(pendingCoachApproval)}
	<div class="mb-3 max-w-3xl" in:fly={{ y: 6, duration: motionMs * 0.55, easing: cubicOut }}>
		<Confirmation.Root state={pendingCoachApproval.state} approval={pendingCoachApproval.approval}>
			<Confirmation.Request>
				<Confirmation.Title>Approval needed</Confirmation.Title>
				<p class="text-sm leading-6 text-muted-foreground">Pip is ready to make this change.</p>
				<div class="rounded-xl bg-muted/60 p-3">
					<p class="text-sm font-medium">{summary.title}</p>
					<ul class="mt-2 space-y-1 text-sm leading-5 text-muted-foreground">
						{#each summary.lines as line, index (`${line}-${index}`)}
							<li class="flex gap-2">
								<span class="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60"></span>
								<span>{line}</span>
							</li>
						{/each}
					</ul>
				</div>
				<Confirmation.Actions class="justify-start">
					<Confirmation.Action
						disabled={approving}
						onclick={() => respondToApproval(pendingCoachApproval.approvalId, true)}
					>
						{approving ? 'Responding…' : 'Approve update'}
					</Confirmation.Action>
					<Confirmation.Action
						variant="outline"
						disabled={approving}
						onclick={() => respondToApproval(pendingCoachApproval.approvalId, false)}
					>
						Decline
					</Confirmation.Action>
				</Confirmation.Actions>
			</Confirmation.Request>
			<Confirmation.Accepted>
				<Confirmation.Title>Update approved</Confirmation.Title>
			</Confirmation.Accepted>
			<Confirmation.Rejected>
				<Confirmation.Title>Update declined</Confirmation.Title>
			</Confirmation.Rejected>
		</Confirmation.Root>
	</div>
{/if}
