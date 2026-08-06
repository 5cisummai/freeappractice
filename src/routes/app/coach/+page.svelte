<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Chat } from '@ai-sdk/svelte';
	import type { ChatStatus } from 'ai';
	import { DefaultChatTransport } from 'ai';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import SquareIcon from '@lucide/svelte/icons/square';
	import TargetIcon from '@lucide/svelte/icons/target';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Shimmer } from '$lib/components/ai-elements/shimmer/index.js';
	import * as Conversation from '$lib/components/ai-elements/conversation/index.js';
	import * as Message from '$lib/components/ai-elements/message/index.js';
	import * as PromptInput from '$lib/components/ai-elements/prompt-input/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import type { CoachUIMessage } from '$lib/super/coach.server';
	import { cn } from '$lib/utils.js';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let sessionId = $state('');
	let input = $state('');
	let approving = $state(false);
	let lastUsageWarning = $state<number | null>(null);
	let motionMs = $state(320);

	const suggestions: Array<{ text: string; icon: Component }> = [
		{ text: 'What should I study next?', icon: BookOpenIcon },
		{ text: 'Build me a plan for this week', icon: CalendarDaysIcon },
		{ text: 'Help me focus on my weakest unit', icon: TargetIcon }
	];

	const toolActionLabels: Record<string, string> = {
		'tool-read_course_catalog': 'Reading course catalog…',
		'tool-read_profile': 'Reading profile…',
		'tool-read_progress': 'Reading progress…',
		'tool-read_insights': 'Reading insights…',
		'tool-read_study_plan': 'Reading study plan…',
		'tool-update_goals': 'Updating goals…',
		'tool-update_study_plan': 'Updating study plan…'
	};

	const coach = new Chat<CoachUIMessage>({
		messages: [],
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
	let hasMessages = $derived(coach.messages.length > 0);
	let emptyChat = $derived(!hasMessages);

	type CoachToolPart = {
		type: `tool-${string}`;
		state?: string;
		input?: unknown;
		output?: unknown;
		errorText?: string;
	};

	type ApprovalProposal = {
		category: 'goals' | 'study_plans';
		proposed: unknown;
	};

	function getToolPart(part: unknown): CoachToolPart | null {
		if (!part || typeof part !== 'object') return null;
		const candidate = part as { type?: unknown };
		return typeof candidate.type === 'string' && candidate.type.startsWith('tool-')
			? (part as CoachToolPart)
			: null;
	}

	function toolActionLabel(type: string): string {
		return (
			toolActionLabels[type] ??
			`${type
				.replace(/^tool-/, '')
				.replaceAll('_', ' ')
				.replace(/^./, (letter) => letter.toUpperCase())}…`
		);
	}

	function isToolInProgress(state: string | undefined): boolean {
		return state === 'input-streaming' || state === 'input-available';
	}

	function messageText(message: CoachUIMessage): string {
		return message.parts
			.filter((part) => part.type === 'text')
			.map((part) => part.text)
			.join('\n');
	}

	let statusLabel = $derived.by(() => {
		if (!streaming) return null;

		const last = coach.messages.at(-1);
		if (!last || last.role !== 'assistant') return 'Thinking…';
		if (messageText(last).trim()) return null;

		const tools = last.parts.map(getToolPart).filter((part): part is CoachToolPart => part !== null);
		for (let index = tools.length - 1; index >= 0; index -= 1) {
			const tool = tools[index];
			if (isToolInProgress(tool.state)) return toolActionLabel(tool.type);
		}
		return 'Thinking…';
	});

	onMount(() => {
		const key = 'super-coach-session-id';
		sessionId = sessionStorage.getItem(key) ?? crypto.randomUUID();
		sessionStorage.setItem(key, sessionId);
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			motionMs = 0;
		}
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

	function getApprovalProposal(part: CoachToolPart): ApprovalProposal | null {
		if (!part.output || typeof part.output !== 'object') return null;
		const output = part.output as {
			approvalRequired?: unknown;
			category?: unknown;
			proposed?: unknown;
		};
		if (
			output.approvalRequired !== true ||
			(output.category !== 'goals' && output.category !== 'study_plans')
		) {
			return null;
		}
		return { category: output.category, proposed: output.proposed };
	}

	async function copyMessage(message: CoachUIMessage) {
		const text = messageText(message);
		if (!text) return;
		await navigator.clipboard.writeText(text);
		toast.success('Response copied.');
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
			toast.success('Coach can make that change for the next 30 minutes.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not approve Coach changes.');
		} finally {
			approving = false;
		}
	}

	function approveProposedCategory(category: ApprovalProposal['category']) {
		void approve([category]);
	}

	async function send(text: string) {
		const message = text.trim();
		if (!message || streaming || !sessionId) return;
		input = '';
		try {
			await coach.sendMessage({ text: message });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Coach is unavailable right now.');
		}
	}
</script>

<svelte:head><title>Coach – Free AP Practice</title></svelte:head>

{#if !data.entitlements.coach}
	<div class="mx-auto max-w-2xl p-4 sm:p-8">
		<Card.Root>
			<Card.Header>
				<Card.Title>Super Coach</Card.Title>
				<Card.Description>Personalized planning from your practice data.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<p class="text-sm text-muted-foreground">
					Coach is available with Super. Your free practice and progress stay exactly as they are.
				</p>
				<Button href="/pricing">See Super</Button>
			</Card.Content>
		</Card.Root>
	</div>
{:else if !data.coachEnabled}
	<div class="mx-auto max-w-2xl p-4 sm:p-8">
		<Card.Root>
			<Card.Content class="p-6 text-sm text-muted-foreground">
				Coach is temporarily unavailable. Your saved profile, insights, and study plan are
				unaffected.
			</Card.Content>
		</Card.Root>
	</div>
{:else if !data.profile.ageConfirmedAt}
	<div class="mx-auto max-w-2xl p-4 sm:p-8">
		<Card.Root>
			<Card.Header>
				<Card.Title>Confirm your age</Card.Title>
				<Card.Description>Coach uses personalized study information.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<p class="text-sm text-muted-foreground">
					Coach is available to students aged 13 or older.
				</p>
				<Button href="/app/confirm-age">Confirm age</Button>
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<div
		class="flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden bg-background md:min-h-[calc(100svh-5rem)]"
	>
		<main class="flex min-h-0 min-w-0 flex-1 flex-col">
			<div
				class={cn(
					'relative min-h-0 overflow-hidden transition-[flex-grow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
					hasMessages ? 'flex-1' : 'flex-none'
				)}
			>
				{#if hasMessages}
					<div
						class="flex h-full min-h-0 flex-col"
						in:fade={{ duration: motionMs, easing: cubicOut }}
					>
						<Conversation.Root class="min-h-0 flex-1">
							<Conversation.Content
								class="mx-auto w-full max-w-3xl gap-7 px-4 pt-8 pb-6 sm:px-8 sm:pt-10"
								aria-live="polite"
							>
								{#each coach.messages as message (message.id)}
									<Message.Root from={message.role} class="max-w-3xl gap-1">
										{#if message.role === 'user'}
											<Message.Content
												class="max-w-[min(42rem,88%)] text-md leading-6 whitespace-pre-wrap"
											>
												{messageText(message)}
											</Message.Content>
										{:else}
											{#each message.parts as part, index (`${message.id}-${index}`)}
												{@const toolPart = getToolPart(part)}
												{#if part.type === 'text'}
													{#if part.text.trim()}
														<Message.Content class="max-w-3xl text-md leading-7">
															<Message.Response content={part.text} />
														</Message.Content>
													{/if}
												{:else if toolPart}
													{@const approval = getApprovalProposal(toolPart)}
													{#if approval}
														<div
															class="mt-2 max-w-3xl rounded-2xl border border-border/70 bg-muted/30 p-4"
														>
															<p class="text-sm font-medium">Approval needed</p>
															<p class="mt-1 text-sm leading-6 text-muted-foreground">
																Coach is ready to update your {approval.category === 'goals'
																	? 'goals and availability'
																	: 'study plan'}.
															</p>
															<pre
																class="mt-3 max-h-36 overflow-auto rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">{JSON.stringify(
																	approval.proposed,
																	null,
																	2
																)}</pre>
															<Button
																size="sm"
																class="mt-3"
																disabled={approving}
																onclick={() => approveProposedCategory(approval.category)}
															>
																{approving ? 'Approving…' : 'Approve update'}
															</Button>
														</div>
													{/if}
												{/if}
											{/each}
											{#if messageText(message)}
												<Message.Actions
													class="mt-0 opacity-0 transition-opacity group-hover:opacity-100"
												>
													<Message.Action
														tooltip="Copy response"
														label="Copy response"
														onclick={() => void copyMessage(message)}
													>
														<CopyIcon />
													</Message.Action>
												</Message.Actions>
											{/if}
										{/if}
									</Message.Root>
								{/each}
								{#if statusLabel}
									<Message.Root from="assistant" class="max-w-3xl">
										<div role="status" aria-live="polite" aria-label={statusLabel}>
											{#key statusLabel}
												<span in:fade={{ duration: motionMs * 0.45, easing: cubicOut }}>
													<Shimmer as="span" content_length={statusLabel.length} class="text-md">
														{statusLabel}
													</Shimmer>
												</span>
											{/key}
										</div>
									</Message.Root>
								{/if}
							</Conversation.Content>
							<Conversation.ScrollButton aria-label="Scroll to latest message" />
						</Conversation.Root>
					</div>
				{/if}
			</div>

			<div
				class={cn(
					'mx-auto flex w-full max-w-3xl flex-col px-4 transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:px-8',
					emptyChat ? 'min-h-0 flex-1 justify-center pb-10 sm:pb-16' : 'shrink-0 pb-4 sm:pb-6'
				)}
			>
				{#if emptyChat}
					<div
						class="mb-8 text-center sm:mb-10"
						out:fade={{ duration: motionMs * 0.7, easing: cubicOut }}
					>
						<h1
							class="font-display text-3xl leading-tight font-medium tracking-tight text-balance text-foreground sm:text-4xl"
						>
							Ask me about your progress
						</h1>
					</div>
				{/if}

				<PromptInput.Root
					class="rounded-full border border-border/70 bg-background shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow] focus-within:border-border focus-within:shadow-[0_6px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.28)] dark:focus-within:shadow-[0_6px_20px_rgba(0,0,0,0.36)]"
					onSubmit={({ text }) => send(text)}
					clearOnSubmit={false}
				>
					<div class="flex items-end gap-2 py-1.5 pr-1.5 pl-5 sm:pl-6">
						<PromptInput.Body class="min-w-0 flex-1">
							<PromptInput.Textarea
								bind:value={input}
								placeholder="Ask Coach anything…"
								class="text-md md:text-md min-h-9 px-0 py-1.5 leading-6 placeholder:text-muted-foreground/80"
							/>
						</PromptInput.Body>
						<PromptInput.Submit
							status={coach.status as ChatStatus}
							disabled={!sessionId || (!streaming && !input.trim())}
							onStop={() => coach.stop()}
							class="size-9 shrink-0 self-end rounded-full"
						>
							{#if streaming}
								<SquareIcon class="size-4" />
							{:else}
								<ArrowUpIcon class="size-4" />
							{/if}
						</PromptInput.Submit>
					</div>
				</PromptInput.Root>

				{#if emptyChat}
					<ul
						class="mt-5 w-full space-y-0.5 px-1 sm:mt-6 sm:px-2"
						out:fade={{ duration: motionMs * 0.65, easing: cubicOut }}
					>
						{#each suggestions as suggestion (suggestion.text)}
							{@const Icon = suggestion.icon}
							<li>
								<button
									type="button"
									class="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted/80 focus-visible:bg-muted/80 focus-visible:outline-none"
									disabled={!sessionId || streaming}
									onclick={() => void send(suggestion.text)}
								>
									<Icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									<span class="min-w-0 flex-1 text-sm leading-5 text-foreground/85">
										{suggestion.text}
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p
						class="mt-2 text-center text-[11px] text-muted-foreground"
						in:fade={{ duration: motionMs * 0.5, delay: motionMs * 0.25, easing: cubicOut }}
					>
						Coach is powered by AI and can make mistakes.
					</p>
				{/if}
			</div>
		</main>
	</div>
{/if}
