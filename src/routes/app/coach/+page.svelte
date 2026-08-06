<script lang="ts">
	import { onMount } from 'svelte';
	import { Chat } from '@ai-sdk/svelte';
	import type { ChatStatus } from 'ai';
	import { DefaultChatTransport } from 'ai';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Conversation from '$lib/components/ai-elements/conversation/index.js';
	import * as Message from '$lib/components/ai-elements/message/index.js';
	import * as PromptInput from '$lib/components/ai-elements/prompt-input/index.js';
	import * as Tool from '$lib/components/ai-elements/tool/index.js';
	import * as Suggestion from '$lib/components/ai-elements/suggestion/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import type { CoachUIMessage } from '$lib/super/coach.server';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let sessionId = $state('');
	let input = $state('');
	let approving = $state(false);
	let lastUsageWarning = $state<number | null>(null);

	const suggestions = [
		'What should I study next?',
		'Build me a plan for this week',
		'Help me focus on my weakest unit'
	];

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

	type CoachToolState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error';

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

	function getToolPart(part: unknown): CoachToolPart | null {
		if (!part || typeof part !== 'object') return null;
		const candidate = part as { type?: unknown };
		return typeof candidate.type === 'string' && candidate.type.startsWith('tool-')
			? (part as CoachToolPart)
			: null;
	}

	function getToolState(state: string | undefined): CoachToolState {
		if (
			state === 'input-streaming' ||
			state === 'input-available' ||
			state === 'output-available' ||
			state === 'output-error'
		) {
			return state;
		}
		return 'input-available';
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

	function formatToolName(type: string): string {
		return type
			.replace(/^tool-/, '')
			.replaceAll('_', ' ')
			.replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	function messageText(message: CoachUIMessage): string {
		return message.parts
			.filter((part) => part.type === 'text')
			.map((part) => part.text)
			.join('\n');
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
		<div class="flex min-h-0 flex-1">
			<main class="flex min-w-0 flex-1 flex-col">
				<Conversation.Root class="min-h-0 flex-1">
					<Conversation.Content
						class="mx-auto w-full max-w-3xl gap-7 px-4 pt-8 pb-6 sm:px-8 sm:pt-10"
						aria-live="polite"
					>
						{#if hasMessages}
							{#each coach.messages as message (message.id)}
								<Message.Root from={message.role} class="max-w-3xl">
									{#if message.role === 'user'}
										<Message.Content class="max-w-[min(42rem,88%)] leading-6 whitespace-pre-wrap">
											{messageText(message)}
										</Message.Content>
									{:else}
										{#each message.parts as part, index (`${message.id}-${index}`)}
											{@const toolPart = getToolPart(part)}
											{#if part.type === 'text'}
												<Message.Content class="max-w-3xl leading-7">
													<Message.Response content={part.text} />
												</Message.Content>
											{:else if toolPart}
												{@const approval = getApprovalProposal(toolPart)}
												<Tool.Root class="max-w-3xl bg-background">
													<Tool.Header
														type={formatToolName(toolPart.type)}
														state={getToolState(toolPart.state)}
													/>
													<Tool.Content>
														{#if toolPart.input !== undefined}
															<Tool.Input input={toolPart.input} />
														{/if}
														{#if approval}
															<div class="border-t p-4">
																<div class="flex items-start gap-3">
																	<div
																		class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
																	></div>
																	<div class="min-w-0 flex-1 space-y-1">
																		<p class="text-sm font-medium">Approval needed</p>
																		<p class="text-sm leading-6 text-muted-foreground">
																			Coach is ready to update your {approval.category === 'goals'
																				? 'goals and availability'
																				: 'study plan'}.
																		</p>
																	</div>
																</div>
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
														{:else}
															<Tool.Output
																output={toolPart.output}
																errorText={toolPart.errorText}
															/>
														{/if}
													</Tool.Content>
												</Tool.Root>
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
							{#if streaming}
								<Message.Root from="assistant" class="max-w-3xl">
									<div
										class="flex items-center gap-2 text-sm text-muted-foreground"
										role="status"
										aria-label="Coach is thinking"
									>
										<LoaderCircleIcon class="size-4 animate-spin" aria-hidden="true" />
										<span>Coach is thinking…</span>
									</div>
								</Message.Root>
							{/if}
						{:else}
							<div
								class="flex size-full min-h-[18rem] items-center justify-center px-6 py-16 text-center"
							>
								<p
									class="max-w-2xl font-display text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl"
								>
									Ask me any study questions
								</p>
							</div>
						{/if}
					</Conversation.Content>
					<Conversation.ScrollButton aria-label="Scroll to latest message" />
				</Conversation.Root>

				<div class="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4 sm:px-8 sm:pb-6">
					{#if !hasMessages && !streaming}
						<Suggestion.Suggestions class="mb-3 overflow-x-auto pb-1">
							{#each suggestions as suggestion (suggestion)}
								<Suggestion.Suggestion {suggestion} onclick={(value) => void send(value)} />
							{/each}
						</Suggestion.Suggestions>
					{/if}

					<PromptInput.Root
						class="rounded-[32px] border border-border/80 bg-muted/40 shadow-sm transition-[border-color,box-shadow,background-color] focus-within:border-border focus-within:bg-background focus-within:shadow-md"
						onSubmit={({ text }) => send(text)}
						clearOnSubmit={false}
					>
						<div class="flex items-end gap-2 py-2 pr-3 pl-6">
							<PromptInput.Body class="min-w-0 flex-1">
								<PromptInput.Textarea
									bind:value={input}
									placeholder="Ask Coach anything…"
									class="text-md md:text-md min-h-10 px-1 py-2 leading-7"
								/>
							</PromptInput.Body>
							<PromptInput.Submit
								status={coach.status as ChatStatus}
								disabled={!sessionId || (!streaming && !input.trim())}
								onStop={() => coach.stop()}
								class="mb-0.5 size-9 shrink-0 rounded-full"
							/>
						</div>
					</PromptInput.Root>
					<p class="mt-2 text-center text-[11px] text-muted-foreground">
						Coach is powered by AI and can make mistakes.
					</p>
				</div>
			</main>
		</div>
	</div>
{/if}
