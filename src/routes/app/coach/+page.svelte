<script lang="ts">
	import { onMount } from 'svelte';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import type { CoachUIMessage } from '$lib/super/coach.server';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let sessionId = $state('');
	let input = $state('');
	let approving = $state(false);
	let lastUsageWarning = $state<number | null>(null);
	let undoingAuditId = $state<string | null>(null);

	const coach = new Chat<CoachUIMessage>({
		messages: [
			{
				id: 'welcome',
				role: 'assistant',
				parts: [
					{
						type: 'text',
						text: 'I can turn your recent practice into a realistic plan. Ask about a course, a target date, or what to study next.'
					}
				]
			}
		],
		transport: new DefaultChatTransport<CoachUIMessage>({
			api: '/api/coach',
			fetch: async (url, init) => {
				const response = await apiFetch(String(url), init);
				showUsageWarning(response);
				return response;
			},
			prepareSendMessagesRequest: ({ messages }) => ({
				body: { sessionId, messages: messages.slice(-12) }
			})
		})
	});
	let streaming = $derived(coach.status === 'submitted' || coach.status === 'streaming');

	onMount(() => {
		const key = 'super-coach-session-id';
		sessionId = sessionStorage.getItem(key) ?? crypto.randomUUID();
		sessionStorage.setItem(key, sessionId);
	});

	function showUsageWarning(response: Response) {
		const warning = Number(response.headers.get('X-Super-Usage-Warning'));
		const remaining = Number(response.headers.get('X-Super-Usage-Remaining'));
		if ((warning !== 80 && warning !== 95) || lastUsageWarning === warning) return;
		lastUsageWarning = warning;
		toast.message(
			warning === 95
				? `You have ${remaining} personalized AI messages left this month.`
				: `You have used ${warning}% of this month's personalized AI messages.`
		);
	}

	async function approve(categories: Array<'goals' | 'study_plans'>) {
		if (!sessionId || approving) return;
		approving = true;
		try {
			const response = await apiFetch('/api/coach/approval', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId, categories })
			});
			const result = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(result, 'Could not approve Coach changes.'));
			toast.success('Coach can make those approved changes for the next 30 minutes.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not approve Coach changes.');
		} finally {
			approving = false;
		}
	}

	function approveProposedCategory(category: unknown) {
		if (category === 'goals' || category === 'study_plans') void approve([category]);
	}

	async function send() {
		const message = input.trim();
		if (!message || streaming || !sessionId) return;
		input = '';
		try {
			await coach.sendMessage({ text: message });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Coach is unavailable right now.');
		}
	}

	async function undoChange(auditId: string) {
		if (undoingAuditId) return;
		undoingAuditId = auditId;
		try {
			const response = await apiFetch('/api/coach/undo', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ auditId })
			});
			const result = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(result, 'Could not undo that Coach change.'));
			toast.success('Coach change undone.');
			window.location.reload();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not undo that Coach change.');
		} finally {
			undoingAuditId = null;
		}
	}
</script>

<svelte:head><title>Coach – Free AP Practice</title></svelte:head>

<PageShell
	title="Coach"
	description="A constrained planning assistant that works from your own AP practice data."
>
	{#if !data.entitlements.coach}
		<Card.Root class="mx-auto max-w-2xl"
			><Card.Content class="space-y-3 p-6"
				><h2 class="font-display text-2xl">Super feature</h2>
				<p class="text-sm text-muted-foreground">
					Coach is available with Super. Your free practice and progress stay exactly as they are.
				</p>
				<Button href="/pricing">See Super</Button></Card.Content
			></Card.Root
		>
	{:else if !data.coachEnabled}
		<Card.Root class="mx-auto max-w-2xl"
			><Card.Content class="p-6 text-sm text-muted-foreground"
				>Coach is temporarily unavailable. Your saved profile, insights, and study plan are
				unaffected.</Card.Content
			></Card.Root
		>
	{:else if !data.profile.ageConfirmedAt}
		<Card.Root class="mx-auto max-w-2xl"
			><Card.Content class="space-y-3 p-6"
				><h2 class="font-display text-2xl">Confirm your age</h2>
				<p class="text-sm text-muted-foreground">
					Coach uses personalized study information and is available to students aged 13 or older.
				</p>
				<Button href="/app/confirm-age">Confirm age</Button></Card.Content
			></Card.Root
		>
	{:else}
		<div class="mx-auto grid max-w-3xl gap-4">
			<Card.Root
				><Card.Content class="space-y-3 p-4"
					><p class="text-sm font-medium">
						Coach can only change selected AP classes, target dates, study availability, and your
						study plan — never grades, attempts, memory/privacy, age, billing, or your calendar.
					</p>
					<p class="text-sm text-muted-foreground">
						When Coach proposes one of those changes, approve that specific category for 30 minutes
						from its approval card.
					</p></Card.Content
				></Card.Root
			>
			<Card.Root
				><Card.Content class="space-y-4 p-5"
					><div class="max-h-[28rem] space-y-3 overflow-y-auto" aria-live="polite">
						{#each coach.messages as message (message.id)}<div
								class={message.role === 'user'
									? 'ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground'
									: 'max-w-[90%] rounded-2xl bg-muted px-3 py-2 text-sm text-foreground'}
							>
								{#each message.parts as part, index (`${message.id}-${index}`)}
									{#if part.type === 'text'}{part.text}
									{:else if part.type === 'tool-update_goals' || part.type === 'tool-update_study_plan'}
										{#if part.state === 'output-available' && part.output.updated === false && part.output.approvalRequired}
											<div
												class="space-y-2 rounded-md border border-primary/30 bg-background p-3 text-xs"
											>
												<p class="font-medium">Coach is proposing a permitted change.</p>
												<pre
													class="max-h-40 overflow-auto whitespace-pre-wrap text-muted-foreground">{JSON.stringify(
														part.output.proposed,
														null,
														2
													)}</pre>
												<Button
													size="sm"
													disabled={approving}
													onclick={() => approveProposedCategory(part.output.category)}
													>{approving ? 'Approving…' : 'Approve this category for 30 min'}</Button
												>
											</div>
										{:else}<p
												class="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground"
											>
												{part.state === 'output-available'
													? 'Coach completed a permitted update.'
													: part.state === 'output-error'
														? 'Coach could not complete that update.'
														: 'Coach is preparing an allowed update…'}
											</p>{/if}
									{:else if part.type.startsWith('tool-')}
										<p class="text-xs text-muted-foreground">Coach is checking your study data…</p>
									{/if}
								{/each}
							</div>{/each}
					</div>
					<form
						class="flex gap-2"
						onsubmit={(event) => {
							event.preventDefault();
							void send();
						}}
					>
						<textarea
							bind:value={input}
							rows="2"
							placeholder="Ask Coach about your next study step…"
							disabled={streaming}
							class="min-h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
						></textarea><Button type="submit" disabled={streaming || !input.trim() || !sessionId}
							>{streaming ? 'Thinking…' : 'Send'}</Button
						>
					</form></Card.Content
				></Card.Root
			>
			{#if data.audits.length}
				<Card.Root>
					<Card.Header
						><Card.Title>Recent Coach changes</Card.Title><Card.Description
							>Coach changes are retained for 90 days and can be undone once.</Card.Description
						></Card.Header
					>
					<Card.Content class="space-y-2">
						{#each data.audits as audit (audit.id)}
							<div
								class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
							>
								<p class="text-sm">
									{audit.toolName === 'update_goals'
										? 'Updated courses or goals'
										: 'Updated study plan'} · {new Date(audit.createdAt).toLocaleString()}
								</p>
								{#if audit.undoneAt}<span class="text-sm text-muted-foreground">Undone</span
									>{:else}<Button
										variant="outline"
										size="sm"
										disabled={undoingAuditId === audit.id}
										onclick={() => undoChange(audit.id)}
										>{undoingAuditId === audit.id ? 'Undoing…' : 'Undo'}</Button
									>{/if}
							</div>
						{/each}
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	{/if}
</PageShell>
