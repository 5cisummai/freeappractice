<script lang="ts">
	import { onMount, tick, type Component } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Chat } from '@ai-sdk/svelte';
	import type { ChatStatus } from 'ai';
	import { DefaultChatTransport } from 'ai';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SquareIcon from '@lucide/svelte/icons/square';
	import TargetIcon from '@lucide/svelte/icons/target';
	import ThumbsDownIcon from '@lucide/svelte/icons/thumbs-down';
	import ThumbsUpIcon from '@lucide/svelte/icons/thumbs-up';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Shimmer } from '$lib/components/ai-elements/shimmer/index.js';
	import * as Conversation from '$lib/components/ai-elements/conversation/index.js';
	import * as Message from '$lib/components/ai-elements/message/index.js';
	import * as PromptInput from '$lib/components/ai-elements/prompt-input/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import RichText from '$lib/components/content/rich-text.svelte';
	import { diagramDataUrl, getDiagramOutput } from '$lib/super/diagram-ui';
	import type { CoachUIMessage } from '$lib/super/coach.server';
	import { SUPER_GRADIENT_BUTTON_CLASS } from '$lib/super/ui';
	import { cn } from '$lib/utils.js';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let sessionId = $state('');
	let conversationId = $state('');
	let input = $state('');
	let approving = $state(false);
	let lastUsageWarning = $state<number | null>(null);
	let motionMs = $state(320);

	const COACH_SESSION_STORAGE_KEY = 'super-coach-session-id';
	const COACH_CONVERSATION_STORAGE_KEY = 'super-coach-conversation-id';

	const suggestions: Array<{ text: string; icon: Component }> = [
		{ text: 'What should I study next?', icon: BookOpenIcon },
		{ text: 'Build me a plan for this week', icon: CalendarDaysIcon },
		{ text: 'Help me focus on my weakest unit', icon: TargetIcon }
	];

	const toolActivityLabels: Record<string, { running: string; complete: string }> = {
		'tool-read_course_catalog': {
			running: 'Checking the course catalog…',
			complete: 'Checked the course catalog'
		},
		'tool-read_profile': {
			running: 'Reviewing your goals…',
			complete: 'Reviewed your goals'
		},
		'tool-read_progress': {
			running: 'Checking your recent practice…',
			complete: 'Checked your recent practice'
		},
		'tool-read_quiz_attempt': {
			running: 'Reviewing your quiz…',
			complete: 'Reviewed your quiz'
		},
		'tool-read_insights': {
			running: 'Reviewing your insights…',
			complete: 'Reviewed your insights'
		},
		'tool-read_study_plan': {
			running: 'Checking your study plan…',
			complete: 'Checked your study plan'
		},
		'tool-update_goals': {
			running: 'Preparing a goals update…',
			complete: 'Prepared a goals update'
		},
		'tool-update_study_plan': {
			running: 'Preparing a study plan…',
			complete: 'Prepared a study plan'
		},
		'tool-generate_diagram': {
			running: 'Drawing a diagram…',
			complete: 'Drew a diagram'
		}
	};

	const coach = new Chat<CoachUIMessage>({
		messages: [],
		transport: new DefaultChatTransport<CoachUIMessage>({
			api: '/api/coach',
			fetch: async (url, init) => {
				const response = await apiFetch(String(url), init);
				const responseConversationId = response.headers.get('X-Super-Conversation-Id');
				if (responseConversationId) {
					conversationId = responseConversationId;
					sessionStorage.setItem(COACH_CONVERSATION_STORAGE_KEY, responseConversationId);
				}
				showUsageWarning(response);
				return response;
			},
			prepareSendMessagesRequest: ({ messages }) => ({
				body: {
					sessionId,
					...(conversationId ? { conversationId } : {}),
					messages: messages.slice(-12)
				}
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

	type ToolActivity = {
		key: string;
		type: string;
		label: string;
		state: 'running' | 'complete' | 'error';
	};

	type ApprovalSummary = {
		title: string;
		lines: string[];
	};

	let activityOpen = $state<Record<string, boolean>>({});

	function getToolPart(part: unknown): CoachToolPart | null {
		if (!part || typeof part !== 'object') return null;
		const candidate = part as { type?: unknown };
		return typeof candidate.type === 'string' && candidate.type.startsWith('tool-')
			? (part as CoachToolPart)
			: null;
	}

	function toolActivityLabel(type: string, state: ToolActivity['state']): string {
		const labels = toolActivityLabels[type];
		if (labels) return state === 'running' ? labels.running : labels.complete;
		const name = type
			.replace(/^tool-/, '')
			.replaceAll('_', ' ')
			.replace(/^./, (letter) => letter.toUpperCase());
		return state === 'running'
			? `Working on ${name.toLowerCase()}…`
			: `Finished ${name.toLowerCase()}`;
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

	function getToolActivity(part: CoachToolPart, index: number): ToolActivity {
		const state =
			part.errorText || part.state === 'output-error'
				? 'error'
				: isToolInProgress(part.state)
					? 'running'
					: 'complete';
		return {
			key: `${part.type}-${index}`,
			type: part.type,
			label: state === 'error' ? 'Could not finish this step' : toolActivityLabel(part.type, state),
			state
		};
	}

	function getToolActivityIcon(type: string): Component {
		return type.startsWith('tool-update_') ? PencilIcon : SearchIcon;
	}

	function getToolActivities(message: CoachUIMessage): ToolActivity[] {
		return message.parts.flatMap((part, index) => {
			const toolPart = getToolPart(part);
			return toolPart ? [getToolActivity(toolPart, index)] : [];
		});
	}

	function activitySummary(activities: ToolActivity[]): string {
		const active = activities.find((activity) => activity.state === 'running');
		if (active) return active.label;
		if (activities.some((activity) => activity.state === 'error'))
			return 'Some activity could not finish';
		if (activities.length === 1) return activities[0].label;
		return `Completed ${activities.length} steps`;
	}

	function isActivityOpen(messageId: string): boolean {
		return activityOpen[messageId] ?? streaming;
	}

	function toggleActivity(messageId: string): void {
		activityOpen[messageId] = !isActivityOpen(messageId);
	}

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

	function formatStudyTask(value: unknown): string | null {
		const task = asRecord(value);
		const pieces = [
			formatDate(task.date),
			typeof task.apClass === 'string' ? task.apClass : null,
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
					const apClass = typeof item.apClass === 'string' ? item.apClass : 'AP course';
					const date = formatDate(item.targetDate);
					lines.push(date ? `${apClass} target: ${date}` : `${apClass} target date`);
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
			? proposed.tasks.map(formatStudyTask).filter((task): task is string => Boolean(task))
			: [];
		const lines = tasks.slice(0, 4);
		if (tasks.length > 4) lines.push(`Plus ${tasks.length - 4} more study sessions`);
		return {
			title: 'Update your study plan',
			lines: lines.length ? lines : ['Review the proposed changes to your study plan.']
		};
	}

	let statusLabel = $derived.by(() => {
		if (!streaming) return null;

		const last = coach.messages.at(-1);
		if (!last || last.role !== 'assistant') return 'Working on it…';

		const tools = last.parts
			.map(getToolPart)
			.filter((part): part is CoachToolPart => part !== null);
		if (tools.some((tool) => isToolInProgress(tool.state))) return null;
		if (messageText(last).trim()) return null;
		return tools.length ? null : 'Working on it…';
	});

	onMount(() => {
		const prompt = new URLSearchParams(window.location.search).get('prompt')?.trim() ?? '';
		sessionId = prompt
			? crypto.randomUUID()
			: (sessionStorage.getItem(COACH_SESSION_STORAGE_KEY) ?? crypto.randomUUID());
		sessionStorage.setItem(COACH_SESSION_STORAGE_KEY, sessionId);
		conversationId = prompt ? '' : (sessionStorage.getItem(COACH_CONVERSATION_STORAGE_KEY) ?? '');
		if (conversationId) void loadConversation(conversationId);
		if (prompt) {
			const url = new URL(window.location.href);
			url.searchParams.delete('prompt');
			window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
			void tick().then(() => send(prompt));
		}
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			motionMs = 0;
		}
	});

	async function loadConversation(id: string): Promise<void> {
		try {
			const response = await apiFetch(`/api/super/conversations/${id}`);
			const payload = await readJsonOrNull<{
				messages?: Array<{
					id: string;
					role: 'user' | 'assistant';
					parts: CoachUIMessage['parts'];
				}>;
			}>(response);
			if (!response.ok || !payload?.messages) return;
			coach.messages = payload.messages as CoachUIMessage[];
		} catch {
			conversationId = '';
			sessionStorage.removeItem(COACH_CONVERSATION_STORAGE_KEY);
		}
	}

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

	async function copyText(text: string, successMessage: string): Promise<void> {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			toast.success(successMessage);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not copy that text.');
		}
	}

	async function copyMessage(message: CoachUIMessage): Promise<void> {
		const text = messageText(message);
		await copyText(text, 'Response copied.');
	}

	async function copyPrompt(message: CoachUIMessage): Promise<void> {
		await copyText(messageText(message), 'Prompt copied.');
	}

	async function regenerateMessage(messageId: string): Promise<void> {
		if (streaming) return;
		try {
			await coach.regenerate({ messageId });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not regenerate the response.');
		}
	}

	async function retryPrompt(messageId: string): Promise<void> {
		if (streaming) return;
		const messageIndex = coach.messages.findIndex((message) => message.id === messageId);
		const prompt = coach.messages[messageIndex];
		if (!prompt) return;

		const response = coach.messages
			.slice(messageIndex + 1)
			.find((message) => message.role === 'assistant');
		if (response) {
			await regenerateMessage(response.id);
			return;
		}
		await send(messageText(prompt));
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

	function startNewConversation(): void {
		if (streaming) coach.stop();
		coach.messages = [];
		conversationId = '';
		sessionId = crypto.randomUUID();
		activityOpen = {};
		sessionStorage.setItem(COACH_SESSION_STORAGE_KEY, sessionId);
		sessionStorage.removeItem(COACH_CONVERSATION_STORAGE_KEY);
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
		class="flex h-[calc(100svh-4rem)] min-h-0 flex-col overflow-hidden bg-background md:h-[calc(100svh-5rem)]"
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
						<div class="mx-auto flex w-full max-w-3xl justify-end px-4 pt-3 sm:px-8">
							<Button
								variant="ghost"
								size="icon"
								class="size-10 rounded-xl bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
								onclick={startNewConversation}
								aria-label="Start a new conversation"
								title="New conversation"
							>
								<PencilIcon class="size-5" strokeWidth={1.5} />
							</Button>
						</div>
						<Conversation.Root class="min-h-0 min-w-0 flex-1">
							<Conversation.Content
								class="mx-auto no-scrollbar min-h-0 w-full max-w-3xl flex-1 overflow-y-auto overscroll-contain px-4 pt-8 pb-6 sm:px-8 sm:pt-10"
								aria-live="polite"
							>
								{#each coach.messages as message, messageIndex (message.id)}
									<Message.Root from={message.role} class="max-w-3xl gap-1">
										{#if message.role === 'user'}
											<Message.Content
												class="text-md max-w-[min(42rem,88%)] leading-6 whitespace-pre-wrap"
											>
												{messageText(message)}
											</Message.Content>
											{#if messageText(message)}
												<Message.Actions class="mt-0 ml-auto">
													<Message.Action
														tooltip="Copy prompt"
														label="Copy prompt"
														onclick={() => void copyPrompt(message)}
													>
														<CopyIcon />
													</Message.Action>
													<Message.Action
														tooltip="Retry prompt"
														label="Retry prompt"
														disabled={streaming}
														onclick={() => void retryPrompt(message.id)}
													>
														<RefreshCwIcon />
													</Message.Action>
												</Message.Actions>
											{/if}
										{:else}
											{@const activities = getToolActivities(message)}
											{#each message.parts as part, index (`tool-${message.id}-${index}`)}
												{@const toolPart = getToolPart(part)}
												{#if toolPart}
													{@const diagram = getDiagramOutput(toolPart.output)}
													{#if diagram}
														<figure
															class="mt-3 max-w-xl overflow-hidden rounded-xl border border-border/70 bg-white p-2"
														>
															<img
																src={diagramDataUrl(diagram.svg)}
																alt={diagram.accessibleDescription}
																width={diagram.width}
																height={diagram.height}
																class="h-auto max-h-96 w-full object-contain"
															/>
															{#if diagram.title}
																<figcaption class="px-1 pt-1 text-xs text-muted-foreground">
																	{diagram.title}
																</figcaption>
															{/if}
														</figure>
													{/if}
													{@const approval = getApprovalProposal(toolPart)}
													{#if approval}
														{@const summary = getApprovalSummary(approval)}
														<div
															class="mt-2 max-w-3xl rounded-2xl border border-border/70 bg-muted/30 p-4"
															in:fly={{ y: 6, duration: motionMs * 0.55, easing: cubicOut }}
														>
															<p class="text-sm font-medium">Approval needed</p>
															<p class="mt-1 text-sm leading-6 text-muted-foreground">
																Coach is ready to make this change.
															</p>
															<div class="mt-3 rounded-xl bg-muted/60 p-3">
																<p class="text-sm font-medium">{summary.title}</p>
																<ul class="mt-2 space-y-1 text-sm leading-5 text-muted-foreground">
																	{#each summary.lines as line, index (`${line}-${index}`)}
																		<li class="flex gap-2">
																			<span
																				class="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60"
																			></span>
																			<span>{line}</span>
																		</li>
																	{/each}
																</ul>
															</div>
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
											{#if activities.length}
												{@const SummaryIcon = getToolActivityIcon(activities[0].type)}
												<div
													class="group mt-2 max-w-3xl"
													in:fade={{ duration: motionMs * 0.45, easing: cubicOut }}
												>
													<button
														type="button"
														class="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
														aria-expanded={isActivityOpen(message.id)}
														aria-controls={`activity-${message.id}`}
														onclick={() => toggleActivity(message.id)}
													>
														<SummaryIcon
															class={cn(
																'size-4 shrink-0',
																activities.some((activity) => activity.state === 'running') &&
																	'animate-pulse motion-reduce:animate-none',
																activities.some((activity) => activity.state === 'error') &&
																	'text-destructive'
															)}
															aria-hidden="true"
														/>
														<span class="min-w-0 flex-1 truncate font-medium text-foreground/85">
															{activitySummary(activities)}
														</span>
														<ChevronDownIcon
															class={cn(
																'size-3.5 shrink-0 opacity-60 transition-transform duration-200 group-hover:opacity-100',
																isActivityOpen(message.id) && 'rotate-180'
															)}
															aria-hidden="true"
														/>
													</button>
													{#if isActivityOpen(message.id)}
														<div
															id={`activity-${message.id}`}
															class="ml-2 border-l border-border/70 py-1 pl-4 text-sm leading-6 text-muted-foreground"
															aria-live="polite"
															in:slide={{ duration: motionMs * 0.45, easing: cubicOut }}
															out:slide={{ duration: motionMs * 0.3, easing: cubicOut }}
														>
															<ul class="space-y-1">
																{#each activities as activity (activity.key)}
																	{@const ActivityIcon = getToolActivityIcon(activity.type)}
																	<li
																		class="flex items-center gap-2"
																		in:fly={{ y: 4, duration: motionMs * 0.4, easing: cubicOut }}
																	>
																		{#if activity.state === 'running'}
																			<Loader2Icon
																				class="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
																				aria-hidden="true"
																			/>
																		{:else if activity.state === 'error'}
																			<CircleAlertIcon
																				class="size-3.5 shrink-0 text-destructive"
																				aria-hidden="true"
																			/>
																		{/if}
																		<ActivityIcon
																			class="size-3.5 shrink-0 opacity-70"
																			aria-hidden="true"
																		/>
																		<span
																			class={cn(activity.state === 'error' && 'text-destructive')}
																		>
																			{activity.label}
																		</span>
																	</li>
																{/each}
															</ul>
														</div>
													{/if}
												</div>
											{/if}
											{#each message.parts as part, index (`text-${message.id}-${index}`)}
												{#if part.type === 'text' && part.text.trim()}
													<Message.Content class="text-md max-w-3xl leading-7">
														<RichText text={part.text} blocks />
													</Message.Content>
												{/if}
											{/each}
											{#if messageText(message)}
												<Message.Actions
													class={cn(
														'mt-0 transition-opacity',
														messageIndex === coach.messages.length - 1
															? 'opacity-100'
															: 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
													)}
												>
													<Message.Action
														tooltip="Regenerate response"
														label="Regenerate response"
														disabled={streaming}
														onclick={() => void regenerateMessage(message.id)}
													>
														<RefreshCwIcon />
													</Message.Action>
													<Message.Action
														tooltip="Copy response"
														label="Copy response"
														onclick={() => void copyMessage(message)}
													>
														<CopyIcon />
													</Message.Action>
													<Message.Action tooltip="Helpful" label="Helpful">
														<ThumbsUpIcon />
													</Message.Action>
													<Message.Action tooltip="Not helpful" label="Not helpful">
														<ThumbsDownIcon />
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
					class="rounded-[24px] border border-border/70 bg-background shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow] focus-within:border-border focus-within:shadow-[0_6px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.28)] dark:focus-within:shadow-[0_6px_20px_rgba(0,0,0,0.36)]"
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
							class="size-9 shrink-0 self-end rounded-full {SUPER_GRADIENT_BUTTON_CLASS}"
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
