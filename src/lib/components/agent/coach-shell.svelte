<script lang="ts">
	import { onMount, tick, type Component } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import CoachMessages from './coach-messages.svelte';
	import CoachApproval from './coach-approval.svelte';
	import CoachComposer from './coach-composer.svelte';
	import { Chat } from '@ai-sdk/svelte';
	import type { FileUIPart } from 'ai';
	import { coachImageUrl } from '$lib/agent/attachments/images';
	import {
		lastAssistantMessageIsCompleteWithApprovalResponses,
		lastAssistantMessageIsCompleteWithToolCalls
	} from 'ai';
	import BarChart3Icon from '@tabler/icons-svelte/icons/chart-pie-filled';
	import Atom2FilledIcon from '@tabler/icons-svelte/icons/atom-2-filled';
	import BookOpenIcon from '@tabler/icons-svelte/icons/book-filled';
	import CalendarDaysIcon from '@tabler/icons-svelte/icons/calendar-event';
	import ChevronDownIcon from '@tabler/icons-svelte/icons/chevron-down';

	import Loader2Icon from '@tabler/icons-svelte/icons/loader-2';
	import PencilIcon from '@tabler/icons-svelte/icons/pencil-filled';

	import SidebarCloseIcon from '@tabler/icons-svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Conversation from '$lib/components/ai-elements/conversation/index.js';

	import * as Message from '$lib/components/ai-elements/message/index.js';
	import * as PromptInput from '$lib/components/ai-elements/prompt-input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';

	import { apiFetch, readJsonOrNull } from '$lib/client/api.js';

	import CoachConversationMenu from '$lib/components/agent/coach-conversation-menu.svelte';
	import CoachAvatar from '$lib/components/agent/coach-avatar.svelte';

	import { type CoachPracticeQuestionToolOutput } from '$lib/agent/tools/practice';
	import type { AgentUIMessage } from '$lib/agent/agent.server';
	import { createAgentTransport } from '$lib/agent/transport';
	import {
		useCoachPageToolbar,
		useCoachSidebar
	} from '$lib/components/agent/coach-context.svelte.js';
	import {
		coachComposerActions,
		formatCoachComposerMessage,
		type CoachComposerActionId
	} from '$lib/agent/personalization/composer-actions';
	import type { CoachThinkingMode } from '$lib/agent/request';

	import { cn } from '$lib/utils.js';
	import type { ToolUIPartApproval } from '$lib/components/ai-elements/confirmation/confirmation-context.svelte.js';
	import { getApprovalProposal } from '$lib/components/agent/approval';
	import CoachQuestionCard from '$lib/components/agent/coach-question-card.svelte';
	import CoachMessageFeedbackDialog from '$lib/components/agent/coach-message-feedback-dialog.svelte';
	import type { CoachQuestionToolOutput } from '$lib/agent/tools/question';
	import { toast } from 'svelte-sonner';

	type CoachShellProps = {
		surface?: 'page' | 'sidebar';
	};

	let { surface = 'page' }: CoachShellProps = $props();
	const coachSidebar = useCoachSidebar();
	const coachPageToolbar = useCoachPageToolbar();

	let sessionId = $state('');
	let conversationId = $state('');
	let input = $state('');
	let imageInputEnabled = $state(false);
	let attachments = $state<PromptInput.PromptInputAttachmentData[]>([]);
	let approving = $state(false);
	let lastUsageWarning = $state<number | null>(null);
	let motionMs = $state(320);
	let conversations = $state<CoachConversation[]>([]);
	let conversationsLoading = $state(false);
	let conversationsError = $state('');
	let conversationsOpen = $state(false);
	let selectedCoachActionIds = $state<CoachComposerActionId[]>([]);
	let thinkingMode = $state<CoachThinkingMode>('quick');
	let composerInputRef = $state<HTMLTextAreaElement | null>(null);
	let loadingConversationId = $state<string | null>(null);
	let clientReady = $state(false);
	let conversationLoadRequest = 0;
	let pendingCoachActions: CoachComposerActionId[] = [];
	let messageFeedbackById = $state<Record<string, CoachMessageFeedback>>({});
	let notHelpfulFeedbackOpen = $state(false);
	let notHelpfulFeedbackMessageId = $state<string | null>(null);
	const asIcon = (icon: unknown) => icon as Component;

	const coachActionIcons: Record<CoachComposerActionId, Component> = {
		'study-next': asIcon(BookOpenIcon),
		'study-plan': asIcon(CalendarDaysIcon),
		'review-progress': asIcon(BarChart3Icon),
		'physics-sim': asIcon(Atom2FilledIcon)
	};

	const COACH_SESSION_STORAGE_KEY = 'super-coach-session-id';
	const COACH_CONVERSATION_STORAGE_KEY = 'super-coach-conversation-id';

	type CoachConversation = {
		id: string;
		title: string;
		lastMessageAt: string | null;
		createdAt: string;
		updatedAt: string;
	};

	type CoachMessageFeedback = 'helpful' | 'not_helpful';

	const coach = new Chat<AgentUIMessage>({
		messages: [],
		onFinish: () => {
			void loadConversations();
		},
		sendAutomaticallyWhen: ({ messages }) =>
			lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
			lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
		transport: createAgentTransport({
			getSessionId: () => sessionId,
			getConversationId: () => conversationId || undefined,
			setConversationId: (id) => {
				conversationId = id;
				sessionStorage.setItem(COACH_CONVERSATION_STORAGE_KEY, id);
			},
			getContext: () => ({ surface: 'coach', page: 'coach' }),
			onUsageWarning: showUsageWarning,
			onConversationIdChange: () => void loadConversations(),
			getThinkingMode: () => thinkingMode,
			getCoachActions: () => pendingCoachActions,
			onImageUploaded: (id) => {
				attachments = [];
				const lastUser = coach.messages.findLast((message) => message.role === 'user');
				if (!lastUser) return;
				coach.messages = coach.messages.map((message) =>
					message.id === lastUser.id
						? {
								...message,
								parts: message.parts.map((part) =>
									part.type === 'file'
										? { type: 'file' as const, mediaType: 'image/webp', url: coachImageUrl(id) }
										: part
								)
							}
						: message
				);
			}
		})
	});

	let streaming = $derived(coach.status === 'submitted' || coach.status === 'streaming');
	let composerHasText = $derived(input.trim().length > 0);
	let hasMessages = $derived((coach.messages ?? []).length > 0);
	let emptyChat = $derived(!hasMessages);
	let pendingCoachQuestion = $derived.by(() => {
		const lastMessage = coach.messages.at(-1);
		if (!lastMessage || lastMessage.role !== 'assistant') return null;
		for (const part of [...lastMessage.parts].reverse()) {
			const toolPart = getToolPart(part);
			if (
				toolPart?.type === 'tool-ask_student' &&
				isToolInProgress(toolPart.state) &&
				typeof toolPart.toolCallId === 'string'
			) {
				return { toolCallId: toolPart.toolCallId, input: toolPart.input };
			}
		}
		return null;
	});
	let pendingCoachApproval = $derived.by(() => {
		const lastMessage = coach.messages.at(-1);
		if (!lastMessage || lastMessage.role !== 'assistant') return null;
		for (const part of [...lastMessage.parts].reverse()) {
			const toolPart = getToolPart(part);
			if (!toolPart) continue;
			const approval = getApprovalProposal(toolPart);
			if (approval?.state === 'approval-requested') return approval;
		}
		return null;
	});
	type CoachToolPart = {
		type: `tool-${string}`;
		toolCallId?: string;
		state?: string;
		input?: unknown;
		output?: unknown;
		errorText?: string;
		approval?: ToolUIPartApproval;
	};

	function getToolPart(part: unknown): CoachToolPart | null {
		if (!part || typeof part !== 'object') return null;
		const candidate = part as { type?: unknown };
		return typeof candidate.type === 'string' && candidate.type.startsWith('tool-')
			? (part as CoachToolPart)
			: null;
	}

	function isToolInProgress(state: string | undefined): boolean {
		return state === 'input-streaming' || state === 'input-available';
	}

	function messageText(message: AgentUIMessage): string {
		return message.parts
			.filter((part) => part.type === 'text')
			.map((part) => part.text)
			.join('\n');
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

	function formatConversationDate(conversation: CoachConversation): string {
		return (
			formatDate(conversation.lastMessageAt ?? conversation.updatedAt) ??
			formatDate(conversation.createdAt) ??
			'No messages yet'
		);
	}

	// Only show the floating thinking blob before an assistant message exists.
	// Once the assistant row is present, its CoachAvatar owns the thinking state.
	let showThinkingIndicator = $derived.by(() => {
		if (!streaming) return false;
		const last = coach.messages.at(-1);
		return !last || last.role !== 'assistant';
	});

	onMount(() => {
		void apiFetch('/api/coach/images')
			.then(readJsonOrNull)
			.then((result) => {
				imageInputEnabled = Boolean((result as { enabled?: boolean } | null)?.enabled);
			})
			.catch(() => undefined);
		clientReady = true;
		const url = new URL(window.location.href);
		const query = surface === 'page' ? (url.searchParams.get('q')?.trim() ?? '') : '';
		sessionId = query
			? crypto.randomUUID()
			: (sessionStorage.getItem(COACH_SESSION_STORAGE_KEY) ?? crypto.randomUUID());
		sessionStorage.setItem(COACH_SESSION_STORAGE_KEY, sessionId);
		if (query) {
			sessionStorage.removeItem(COACH_CONVERSATION_STORAGE_KEY);
			url.searchParams.delete('q');
			window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
		}
		conversationId = query ? '' : (sessionStorage.getItem(COACH_CONVERSATION_STORAGE_KEY) ?? '');
		if (conversationId) {
			const storedConversationId = conversationId;
			void loadConversation(storedConversationId).then((loaded) => {
				if (!loaded && conversationId === storedConversationId) {
					conversationId = '';
					sessionStorage.removeItem(COACH_CONVERSATION_STORAGE_KEY);
				}
			});
		}
		void loadConversations();
		if (query) input = query;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			motionMs = 0;
		}
	});

	$effect(() => {
		if (conversationsOpen) void loadConversations();
	});

	$effect(() => {
		if (surface !== 'page') return;
		coachPageToolbar.snippet = pageToolbar;
		return () => {
			coachPageToolbar.snippet = null;
		};
	});

	async function loadConversations(): Promise<void> {
		conversationsLoading = true;
		conversationsError = '';
		try {
			const response = await apiFetch('/api/super/conversations');
			const payload = await readJsonOrNull<{ conversations?: CoachConversation[] }>(response);
			if (!response.ok || !payload?.conversations) {
				conversationsError = 'Could not load conversations.';
				return;
			}
			conversations = payload.conversations;
		} catch {
			conversationsError = 'Could not load conversations.';
		} finally {
			conversationsLoading = false;
		}
	}

	async function loadConversation(id: string): Promise<boolean> {
		const request = ++conversationLoadRequest;
		try {
			const response = await apiFetch(`/api/super/conversations/${id}`);
			const payload = await readJsonOrNull<{
				messages?: Array<{
					id: string;
					role: 'user' | 'assistant';
					parts: AgentUIMessage['parts'];
				}>;
			}>(response);
			if (!response.ok || !payload?.messages || request !== conversationLoadRequest) return false;
			await coach.stop();
			coach.messages = payload.messages as AgentUIMessage[];
			return true;
		} catch {
			return false;
		}
	}

	async function selectConversation(id: string): Promise<void> {
		if (id === conversationId || loadingConversationId) return;
		if (streaming) await coach.stop();
		conversationsOpen = false;
		loadingConversationId = id;
		const loaded = await loadConversation(id);
		if (loadingConversationId !== id) return;
		if (loaded) {
			conversationId = id;
			sessionId = crypto.randomUUID();
			sessionStorage.setItem(COACH_SESSION_STORAGE_KEY, sessionId);
			sessionStorage.setItem(COACH_CONVERSATION_STORAGE_KEY, id);
		} else if (conversationLoadRequest > 0) {
			toast.error('Could not load that conversation.');
		}
		loadingConversationId = null;
	}

	function showUsageWarning(response: Response) {
		const warning = Number(response.headers.get('X-Super-Usage-Warning'));
		const remaining = Number(response.headers.get('X-Super-Usage-Remaining'));
		if ((warning !== 80 && warning !== 95) || lastUsageWarning === warning) return;
		lastUsageWarning = warning;
		toast.message(
			warning === 95
				? `You have ${remaining} Coach credits left this month.`
				: `You have used ${warning}% of this month's Coach credits.`
		);
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

	async function copyMessage(message: AgentUIMessage): Promise<void> {
		const text = messageText(message);
		await copyText(text, 'Response copied.');
	}

	function toggleMessageFeedback(messageId: string, feedback: CoachMessageFeedback): void {
		if (messageFeedbackById[messageId] === feedback) {
			const rest = { ...messageFeedbackById };
			delete rest[messageId];
			messageFeedbackById = rest;
			return;
		}
		messageFeedbackById = { ...messageFeedbackById, [messageId]: feedback };
	}

	function openNotHelpfulFeedback(messageId: string): void {
		if (messageFeedbackById[messageId] === 'not_helpful') {
			toggleMessageFeedback(messageId, 'not_helpful');
			return;
		}
		notHelpfulFeedbackMessageId = messageId;
		notHelpfulFeedbackOpen = true;
	}

	function handleNotHelpfulFeedbackSubmitted(messageId: string): void {
		messageFeedbackById = { ...messageFeedbackById, [messageId]: 'not_helpful' };
	}

	async function regenerateMessage(messageId: string): Promise<void> {
		if (streaming) return;
		try {
			await coach.regenerate({ messageId });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not regenerate the response.');
		}
	}

	async function respondToApproval(approvalId: string, approved: boolean) {
		if (!approvalId || approving) return;
		approving = true;
		try {
			await coach.addToolApprovalResponse({
				id: approvalId,
				approved
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not respond to Pip.');
		} finally {
			approving = false;
		}
	}

	async function submitPracticeQuestionResult(
		toolCallId: string,
		output: CoachPracticeQuestionToolOutput
	): Promise<boolean> {
		if (!toolCallId || streaming) return false;
		try {
			await coach.addToolOutput({
				tool: 'give_practice_question',
				toolCallId,
				output
			});
			return true;
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Could not submit your practice answer.'
			);
			return false;
		}
	}

	async function submitCoachQuestionResult(
		toolCallId: string,
		output: CoachQuestionToolOutput
	): Promise<boolean> {
		if (!toolCallId || streaming) return false;
		try {
			await coach.addToolOutput({ tool: 'ask_student', toolCallId, output });
			return true;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not submit your response.');
			return false;
		}
	}

	async function send(text: string, files?: FileUIPart[]) {
		const trimmed = text.trim();
		const actionIds = [...selectedCoachActionIds];
		if (
			(!trimmed && actionIds.length === 0 && !files?.length) ||
			streaming ||
			pendingCoachQuestion ||
			!sessionId
		)
			return;

		const message = formatCoachComposerMessage(trimmed, actionIds);
		pendingCoachActions = actionIds;
		input = '';
		selectedCoachActionIds = [];
		try {
			await coach.sendMessage({
				text: message,
				...(imageInputEnabled && files?.length ? { files } : {})
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Pip is unavailable right now.');
		} finally {
			pendingCoachActions = [];
		}
	}

	function addCoachAction(actionId: CoachComposerActionId) {
		if (selectedCoachActionIds.includes(actionId)) return;
		selectedCoachActionIds = [...selectedCoachActionIds, actionId];
		void tick().then(() => composerInputRef?.focus());
	}

	async function startNewConversation(): Promise<void> {
		attachments = [];
		if (streaming) await coach.stop();
		conversationLoadRequest++;
		coach.messages = [];
		conversationId = '';
		sessionId = crypto.randomUUID();
		selectedCoachActionIds = [];
		conversationsOpen = false;
		loadingConversationId = null;
		sessionStorage.setItem(COACH_SESSION_STORAGE_KEY, sessionId);
		sessionStorage.removeItem(COACH_CONVERSATION_STORAGE_KEY);
	}

	function handleConversationRenamed(updated: Pick<CoachConversation, 'id' | 'title'>) {
		conversations = conversations.map((conversation) =>
			conversation.id === updated.id ? { ...conversation, title: updated.title } : conversation
		);
	}

	async function handleConversationDeleted(id: string) {
		conversations = conversations.filter((conversation) => conversation.id !== id);
		if (conversationId !== id) return;
		await startNewConversation();
	}
</script>

{#snippet conversationControls()}
	<Button
		variant="ghost"
		class="rounded-xl bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
		onclick={startNewConversation}
		aria-label="Start a new chat"
		title="New chat"
	>
		<PencilIcon class="size-4" aria-hidden="true" />
		<span>New Chat</span>
	</Button>
	{#if clientReady}
		<Popover.Root bind:open={conversationsOpen}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						class="rounded-xl bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-expanded={conversationsOpen}
						aria-label="Show conversations"
					>
						<span>Conversations</span>
						<ChevronDownIcon
							class={cn('size-4 transition-transform', conversationsOpen && 'rotate-180')}
							aria-hidden="true"
						/>
					</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content align="end" class="w-[min(22rem,calc(100vw-2rem))] gap-0 p-1">
				<div class="flex items-center justify-between px-3 py-2">
					<span class="text-sm font-medium">Conversations</span>
					{#if conversationsLoading}
						<Loader2Icon class="size-4 animate-spin text-muted-foreground" aria-label="Loading" />
					{/if}
				</div>
				{#if conversationsError}
					<div class="space-y-2 px-3 py-3 text-sm text-muted-foreground">
						<p>{conversationsError}</p>
						<button
							type="button"
							class="font-medium text-foreground underline underline-offset-4 hover:no-underline"
							onclick={() => void loadConversations()}
						>
							Try again
						</button>
					</div>
				{:else if conversationsLoading && !conversations.length}
					<p class="px-3 py-3 text-sm text-muted-foreground">Loading conversations…</p>
				{:else if !conversations.length}
					<p class="px-3 py-3 text-sm text-muted-foreground">No conversations yet.</p>
				{:else}
					<div class="max-h-72 overflow-y-auto">
						{#each conversations as conversation (conversation.id)}
							<div
								class={cn(
									'group flex w-full items-start gap-1 rounded-lg transition-colors focus-within:bg-muted hover:bg-muted',
									conversation.id === conversationId && 'bg-muted'
								)}
							>
								<button
									type="button"
									class="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left focus-visible:outline-none disabled:opacity-50"
									aria-current={conversation.id === conversationId ? 'page' : undefined}
									disabled={loadingConversationId !== null}
									onclick={() => void selectConversation(conversation.id)}
								>
									<span
										class="ph-mask-pii min-w-0 flex-1 truncate text-sm font-medium text-foreground"
									>
										{conversation.title}
									</span>
									<span class="shrink-0 text-xs text-muted-foreground">
										{formatConversationDate(conversation)}
									</span>
								</button>
								<CoachConversationMenu
									{conversation}
									disabled={loadingConversationId !== null}
									class="mr-1 self-center"
									onRenamed={handleConversationRenamed}
									onDeleted={(id) => void handleConversationDeleted(id)}
								/>
							</div>
						{/each}
					</div>
				{/if}
			</Popover.Content>
		</Popover.Root>
	{/if}
{/snippet}

{#snippet pageToolbar()}
	<div class="flex items-center gap-2">
		{@render conversationControls()}
	</div>
{/snippet}

<div
	class={cn(
		'flex min-h-0 flex-col overflow-hidden',
		surface === 'page' ? 'h-[calc(100svh-4rem)] md:h-[calc(100svh-5rem)]' : 'h-full min-h-0'
	)}
>
	<div class="flex min-h-0 min-w-0 flex-1 flex-col">
		{#if surface === 'sidebar'}
			<div class="mx-auto flex w-full max-w-3xl justify-end gap-2 px-2 pt-3">
				{@render conversationControls()}
				<Button
					variant="ghost"
					size="icon-sm"
					class="rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label="Close Pip sidebar"
					title="Close Pip sidebar"
					onclick={() => coachSidebar.toggle()}
				>
					<SidebarCloseIcon aria-hidden="true" />
				</Button>
			</div>
		{/if}
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
					<Conversation.Root class="min-h-0 min-w-0 flex-1">
						<Conversation.Content
							class={cn(
								'@container mx-auto no-scrollbar min-h-0 w-full max-w-3xl flex-1 overflow-y-auto overscroll-contain pt-8 pb-6 sm:pt-10',
								surface === 'page' ? 'px-4 sm:px-8' : 'px-2'
							)}
							aria-live="polite"
						>
							<CoachMessages
								messages={coach.messages}
								{streaming}
								{composerHasText}
								{messageFeedbackById}
								{regenerateMessage}
								{copyMessage}
								{toggleMessageFeedback}
								{openNotHelpfulFeedback}
								{submitPracticeQuestionResult}
							/>
							{#if showThinkingIndicator}
								<Message.Root from="assistant" class="max-w-3xl">
									<div
										class="flex items-center"
										role="status"
										aria-live="polite"
										aria-label="Pip is thinking"
									>
										<CoachAvatar
											state="thinking"
											expression="attentive"
											size={44}
											interactive
											label="Pip is thinking"
											class="shrink-0"
										/>
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
				'mx-auto flex w-full max-w-3xl flex-col transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
				surface === 'page' ? 'px-4 sm:px-8' : 'px-2',
				emptyChat ? 'min-h-0 flex-1 justify-center pb-10 sm:pb-16' : 'shrink-0 pb-4 sm:pb-6'
			)}
		>
			{#if emptyChat}
				<div
					class="mb-8 flex flex-col items-center text-center sm:mb-10"
					out:fade={{ duration: motionMs * 0.7, easing: cubicOut }}
				>
					<CoachAvatar
						state={streaming ? 'thinking' : 'idle'}
						expression={streaming || composerHasText ? 'attentive' : 'neutral'}
						size={128}
						interactive
						class="mb-5"
					/>
					<h1
						class="font-display text-3xl leading-tight font-medium tracking-tight text-balance text-foreground sm:text-4xl"
					>
						Where should we start?
					</h1>
				</div>
			{/if}

			{#if clientReady}
				{#if pendingCoachApproval}<CoachApproval
						{pendingCoachApproval}
						{approving}
						{respondToApproval}
						{motionMs}
					/>{/if}
				{#if pendingCoachQuestion}
					<CoachQuestionCard
						input={pendingCoachQuestion.input}
						onResolve={(output) =>
							submitCoachQuestionResult(pendingCoachQuestion.toolCallId, output)}
					/>
				{/if}
				<CoachComposer
					bind:input
					bind:attachments
					bind:selectedCoachActionIds
					bind:thinkingMode
					bind:composerInputRef
					{sessionId}
					{streaming}
					pendingQuestion={Boolean(pendingCoachQuestion)}
					{imageInputEnabled}
					status={coach.status}
					{send}
					onStop={() => void coach.stop()}
				/>

				{#if emptyChat}
					<ul
						class="mt-5 w-full space-y-0.5 px-1 sm:mt-6 sm:px-2"
						out:fade={{ duration: motionMs * 0.65, easing: cubicOut }}
					>
						{#each coachComposerActions as action (action.id)}
							{@const Icon = coachActionIcons[action.id]}
							<li>
								<button
									type="button"
									class="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted/80 focus-visible:bg-muted/80 focus-visible:outline-none"
									disabled={!sessionId || streaming}
									onclick={() => addCoachAction(action.id)}
								>
									<Icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									<span class="min-w-0 flex-1 text-sm leading-5 text-foreground/85">
										{action.title}
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
						Pip is powered by AI and can make mistakes.
					</p>
				{/if}
			{/if}
		</div>
	</div>

	<CoachMessageFeedbackDialog
		bind:open={notHelpfulFeedbackOpen}
		messageId={notHelpfulFeedbackMessageId}
		{conversationId}
		messages={coach.messages}
		onSubmitted={handleNotHelpfulFeedbackSubmitted}
	/>
</div>
