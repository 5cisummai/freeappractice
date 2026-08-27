<script lang="ts">
	import { onMount, tick, type Component } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Chat } from '@ai-sdk/svelte';
	import type { ChatStatus } from 'ai';
	import {
		DefaultChatTransport,
		lastAssistantMessageIsCompleteWithApprovalResponses,
		lastAssistantMessageIsCompleteWithToolCalls
	} from 'ai';
	import BarChart3Icon from '@tabler/icons-svelte/icons/chart-pie-filled';
	import BookOpenIcon from '@tabler/icons-svelte/icons/book-filled';
	import CalendarDaysIcon from '@tabler/icons-svelte/icons/calendar-event';
	import ChevronDownIcon from '@tabler/icons-svelte/icons/chevron-down';
	import CopyIcon from '@tabler/icons-svelte/icons/copy';
	import ThumbDownFilledIcon from '@tabler/icons-svelte/icons/thumb-down-filled';
	import ThumbDownIcon from '@tabler/icons-svelte/icons/thumb-down';
	import ThumbUpFilledIcon from '@tabler/icons-svelte/icons/thumb-up-filled';
	import ThumbUpIcon from '@tabler/icons-svelte/icons/thumb-up';
	import CircleAlertIcon from '@tabler/icons-svelte/icons/alert-circle';
	import ArrowUpIcon from '@tabler/icons-svelte/icons/arrow-up';
	import Loader2Icon from '@tabler/icons-svelte/icons/loader-2';
	import PencilIcon from '@tabler/icons-svelte/icons/pencil-filled';
	import RefreshCwIcon from '@tabler/icons-svelte/icons/refresh';
	import SearchIcon from '@tabler/icons-svelte/icons/search';
	import SquareIcon from '@tabler/icons-svelte/icons/square-filled';
	import BoltFilledIcon from '@tabler/icons-svelte/icons/bolt-filled';
	import Sparkles2FilledIcon from '@tabler/icons-svelte/icons/sparkles-2-filled';
	import BrainIcon from '@tabler/icons-svelte/icons/brain';
	import SidebarCloseIcon from '@tabler/icons-svelte/icons/x';
	import XIcon from '@tabler/icons-svelte/icons/x-filled';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Conversation from '$lib/components/ai-elements/conversation/index.js';
	import * as Confirmation from '$lib/components/ai-elements/confirmation/index.js';
	import * as Message from '$lib/components/ai-elements/message/index.js';
	import * as PromptInput from '$lib/components/ai-elements/prompt-input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { apiFetch, readJsonOrNull } from '$lib/client/api.js';
	import RichText from '$lib/components/content/rich-text.svelte';
	import { diagramDataUrl, getDiagramOutput } from '$lib/super/diagram-ui';
	import CoachPracticeQuestionCard from '$lib/components/super/coach-practice-question-card.svelte';
	import CoachPracticeQuestionResult from '$lib/components/super/coach-practice-question-result.svelte';
	import CoachConversationMenu from '$lib/components/super/coach-conversation-menu.svelte';
	import CoachAvatar from '$lib/components/coach/coach-avatar.svelte';
	import { COACH_AVATAR_MONTAGES, COACH_AVATAR_STATES } from '$lib/coach/avatar-state';
	import {
		getCoachPracticeQuestionToolOutput,
		isCoachPracticeQuestionPending,
		type CoachPracticeQuestionToolOutput
	} from '$lib/super/coach-practice-question';
	import type { CoachUIMessage } from '$lib/super/coach.server';
	import { useCoachPageToolbar, useCoachSidebar } from './coach-context.svelte.js';
	import {
		coachComposerActions,
		formatCoachComposerMessage,
		type CoachComposerActionId
	} from '$lib/super/coach-composer-actions';
	import {
		MAX_SUPER_AGENT_MESSAGES,
		minimalSuperAgentClientMessages,
		type CoachThinkingMode
	} from '$lib/super/agent-request';
	import { SUPER_GRADIENT_BUTTON_CLASS } from '$lib/super/ui';
	import { cn } from '$lib/utils.js';
	import type { ToolUIPartApproval } from '$lib/components/ai-elements/confirmation/confirmation-context.svelte.js';
	import { getApprovalProposal, type ApprovalProposal } from '$lib/super/approval-ui';
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
	let approving = $state(false);
	let lastUsageWarning = $state<number | null>(null);
	let motionMs = $state(320);
	let conversations = $state<CoachConversation[]>([]);
	let conversationsLoading = $state(false);
	let conversationsError = $state('');
	let conversationsOpen = $state(false);
	let coachActionsOpen = $state(false);
	let selectedCoachActionIds = $state<CoachComposerActionId[]>([]);
	let thinkingMode = $state<CoachThinkingMode>('quick');
	let composerInputRef = $state<HTMLTextAreaElement | null>(null);
	let loadingConversationId = $state<string | null>(null);
	let clientReady = $state(false);
	let conversationLoadRequest = 0;
	let pendingCoachActions: CoachComposerActionId[] = [];
	let messageFeedbackById = $state<Record<string, CoachMessageFeedback>>({});
	const asIcon = (icon: unknown) => icon as Component;

	const coachActionIcons: Record<CoachComposerActionId, Component> = {
		'study-next': asIcon(BookOpenIcon),
		'study-plan': asIcon(CalendarDaysIcon),
		'review-progress': asIcon(BarChart3Icon)
	};

	const thinkingModeOptions: Array<{
		value: CoachThinkingMode;
		label: string;
		icon: Component;
	}> = [
		{ value: 'quick', label: 'Flash', icon: asIcon(BoltFilledIcon) },
		{ value: 'thinking', label: 'Balanced', icon: asIcon(Sparkles2FilledIcon) },
		{ value: 'deep', label: 'Deep', icon: asIcon(BrainIcon) }
	];

	const selectedThinkingMode = $derived(
		thinkingModeOptions.find((option) => option.value === thinkingMode) ?? thinkingModeOptions[0]
	);

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

	const toolActivityLabels: Record<string, { running: string; complete: string }> = {
		'tool-read_course_catalog': {
			running: 'Checking the course catalog…',
			complete: 'Checked the course catalog'
		},
		'tool-read_profile': {
			running: 'Reviewing your goals…',
			complete: 'Reviewed your goals'
		},
		'tool-read_progress_summary': {
			running: 'Checking your weakest units…',
			complete: 'Checked your weakest units'
		},
		'tool-read_quiz_attempt': {
			running: 'Reviewing your quiz…',
			complete: 'Reviewed your quiz'
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
		},
		'tool-read_activity_summary': {
			running: 'Checking your activity…',
			complete: 'Checked your activity'
		},
		'tool-read_unit_detail': {
			running: 'Reviewing this unit…',
			complete: 'Reviewed this unit'
		},
		'tool-read_frq_performance': {
			running: 'Reviewing your FRQ results…',
			complete: 'Reviewed your FRQ results'
		},
		'tool-give_practice_question': {
			running: 'Waiting for question answer…',
			complete: 'Picked a practice question'
		}
	};

	const coach = new Chat<CoachUIMessage>({
		messages: [],
		sendAutomaticallyWhen: ({ messages }) =>
			lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
			lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
		transport: new DefaultChatTransport<CoachUIMessage>({
			api: '/api/coach',
			fetch: async (url, init) => {
				const response = await apiFetch(String(url), init);
				const responseConversationId = response.headers.get('X-Super-Conversation-Id');
				if (responseConversationId && responseConversationId !== conversationId) {
					conversationId = responseConversationId;
					sessionStorage.setItem(COACH_CONVERSATION_STORAGE_KEY, responseConversationId);
					void loadConversations();
				}
				showUsageWarning(response);
				return response;
			},
			prepareSendMessagesRequest: ({ messages }) => ({
				body: {
					sessionId,
					...(conversationId ? { conversationId } : {}),
					...(pendingCoachActions.length ? { coachActions: pendingCoachActions } : {}),
					thinkingMode,
					messages: conversationId
						? minimalSuperAgentClientMessages(messages)
						: messages.slice(-MAX_SUPER_AGENT_MESSAGES)
				}
			})
		})
	});

	let streaming = $derived(coach.status === 'submitted' || coach.status === 'streaming');
	let composerHasText = $derived(input.trim().length > 0);
	let hasMessages = $derived((coach.messages ?? []).length > 0);
	let emptyChat = $derived(!hasMessages);
	let canSendComposer = $derived(
		Boolean(sessionId) &&
			!streaming &&
			(input.trim().length > 0 || selectedCoachActionIds.length > 0)
	);

	type CoachToolPart = {
		type: `tool-${string}`;
		toolCallId?: string;
		state?: string;
		input?: unknown;
		output?: unknown;
		errorText?: string;
		approval?: ToolUIPartApproval;
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
		return type.startsWith('tool-update_') ? asIcon(PencilIcon) : asIcon(SearchIcon);
	}

	function getToolActivities(message: CoachUIMessage): ToolActivity[] {
		return message.parts.flatMap((part, index) => {
			const toolPart = getToolPart(part);
			return toolPart ? [getToolActivity(toolPart, index)] : [];
		});
	}

	function hasCompletedPracticeQuestion(message: CoachUIMessage): boolean {
		return message.parts.some((part) => {
			const toolPart = getToolPart(part);
			return Boolean(toolPart && getCoachPracticeQuestionToolOutput(toolPart.output));
		});
	}

	function isStreamingAnswer(message: CoachUIMessage, messageIndex: number): boolean {
		return (
			streaming &&
			messageIndex === coach.messages.length - 1 &&
			messageText(message).trim().length > 0
		);
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

	function formatConversationDate(conversation: CoachConversation): string {
		return (
			formatDate(conversation.lastMessageAt ?? conversation.updatedAt) ??
			formatDate(conversation.createdAt) ??
			'No messages yet'
		);
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

	let showThinkingIndicator = $derived.by(() => {
		if (!streaming) return false;

		const last = coach.messages.at(-1);
		if (!last || last.role !== 'assistant') return true;

		const tools = last.parts
			.map(getToolPart)
			.filter((part): part is CoachToolPart => part !== null);
		if (tools.some((tool) => isToolInProgress(tool.state))) return false;
		if (messageText(last).trim()) return false;
		return tools.length === 0;
	});

	onMount(() => {
		clientReady = true;
		const prompt = new URLSearchParams(window.location.search).get('prompt')?.trim() ?? '';
		sessionId = prompt
			? crypto.randomUUID()
			: (sessionStorage.getItem(COACH_SESSION_STORAGE_KEY) ?? crypto.randomUUID());
		sessionStorage.setItem(COACH_SESSION_STORAGE_KEY, sessionId);
		conversationId = prompt ? '' : (sessionStorage.getItem(COACH_CONVERSATION_STORAGE_KEY) ?? '');
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

	$effect(() => {
		if (surface !== 'page') return;
		coachPageToolbar.setSnippet(pageToolbar);
		return () => coachPageToolbar.setSnippet(null);
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
					parts: CoachUIMessage['parts'];
				}>;
			}>(response);
			if (!response.ok || !payload?.messages || request !== conversationLoadRequest) return false;
			await coach.stop();
			coach.messages = payload.messages as CoachUIMessage[];
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
			activityOpen = {};
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
				? `You have ${remaining} personalized AI messages left this month.`
				: `You have used ${warning}% of this month's personalized AI messages.`
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

	async function copyMessage(message: CoachUIMessage): Promise<void> {
		const text = messageText(message);
		await copyText(text, 'Response copied.');
	}

	async function copyPrompt(message: CoachUIMessage): Promise<void> {
		await copyText(messageText(message), 'Prompt copied.');
	}

	function messageFeedback(messageId: string): CoachMessageFeedback | undefined {
		return messageFeedbackById[messageId];
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
		const text = messageText(prompt);
		coach.messages = coach.messages.slice(0, messageIndex);
		await send(text);
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
			toast.error(error instanceof Error ? error.message : 'Could not respond to Coach.');
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

	async function send(text: string) {
		const trimmed = text.trim();
		const actionIds = [...selectedCoachActionIds];
		if ((!trimmed && actionIds.length === 0) || streaming || !sessionId) return;

		const message = formatCoachComposerMessage(trimmed, actionIds);
		pendingCoachActions = actionIds;
		input = '';
		selectedCoachActionIds = [];
		try {
			await coach.sendMessage({ text: message });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Coach is unavailable right now.');
		} finally {
			pendingCoachActions = [];
		}
	}

	function addCoachAction(actionId: CoachComposerActionId) {
		if (selectedCoachActionIds.includes(actionId)) return;
		selectedCoachActionIds = [...selectedCoachActionIds, actionId];
		coachActionsOpen = false;
		void tick().then(() => composerInputRef?.focus());
	}

	function removeCoachAction(actionId: CoachComposerActionId) {
		selectedCoachActionIds = selectedCoachActionIds.filter((id) => id !== actionId);
	}

	function toggleCoachAction(actionId: CoachComposerActionId) {
		if (selectedCoachActionIds.includes(actionId)) {
			removeCoachAction(actionId);
			return;
		}
		addCoachAction(actionId);
	}

	async function startNewConversation(): Promise<void> {
		if (streaming) await coach.stop();
		conversationLoadRequest++;
		coach.messages = [];
		conversationId = '';
		sessionId = crypto.randomUUID();
		activityOpen = {};
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
					aria-label="Close Coach sidebar"
					title="Close Coach sidebar"
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
								'mx-auto no-scrollbar min-h-0 w-full max-w-3xl flex-1 overflow-y-auto overscroll-contain pt-8 pb-6 sm:pt-10',
								surface === 'page' ? 'px-4 sm:px-8' : 'px-2'
							)}
							aria-live="polite"
						>
							{#each coach.messages as message, messageIndex (message.id)}
								<Message.Root
									from={message.role}
									class={cn(
										'ph-mask-pii max-w-3xl gap-1',
										message.role === 'assistant' && 'relative pl-16'
									)}
								>
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
										{@const isCurrentAssistant = messageIndex === coach.messages.length - 1}
										<CoachAvatar
											state={isCurrentAssistant
												? isStreamingAnswer(message, messageIndex)
													? COACH_AVATAR_STATES.waiting
													: streaming
														? COACH_AVATAR_STATES.thinking
														: composerHasText
															? COACH_AVATAR_STATES.waiting
															: activities.some((activity) => activity.state === 'error')
																? COACH_AVATAR_STATES.correction
																: activities.some((activity) => activity.state === 'running')
																	? COACH_AVATAR_STATES.progress
																	: COACH_AVATAR_STATES.waiting
												: COACH_AVATAR_STATES.waiting}
											expression={isCurrentAssistant
												? streaming || composerHasText
													? 'attentive'
													: activities.some((activity) => activity.state === 'error')
														? 'confused'
														: activities.some((activity) => activity.state === 'running')
															? 'curious'
															: 'neutral'
												: 'neutral'}
											montage={isCurrentAssistant
												? activities.some((activity) => activity.state === 'error')
													? COACH_AVATAR_MONTAGES.correction
													: hasCompletedPracticeQuestion(message)
														? COACH_AVATAR_MONTAGES.success
														: undefined
												: undefined}
											size={48}
											paused={!isCurrentAssistant}
											interactive={isCurrentAssistant}
											label="Pip, your study coach"
											class="absolute top-0 left-0"
										/>
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
												{@const practiceQuestionResult = getCoachPracticeQuestionToolOutput(
													toolPart.output
												)}
												{#if isCoachPracticeQuestionPending(toolPart) && toolPart.toolCallId}
													<CoachPracticeQuestionCard
														input={toolPart.input}
														onResolve={(output) =>
															submitPracticeQuestionResult(toolPart.toolCallId!, output)}
													/>
												{:else if practiceQuestionResult}
													<CoachPracticeQuestionResult result={practiceQuestionResult} />
												{/if}
												{@const approval = getApprovalProposal(toolPart)}
												{#if approval}
													{@const summary = getApprovalSummary(approval)}
													<div
														class="mt-2 max-w-3xl"
														in:fly={{ y: 6, duration: motionMs * 0.55, easing: cubicOut }}
													>
														<Confirmation.Root state={approval.state} approval={approval.approval}>
															<Confirmation.Request>
																<Confirmation.Title>Approval needed</Confirmation.Title>
																<p class="text-sm leading-6 text-muted-foreground">
																	Coach is ready to make this change.
																</p>
																<div class="rounded-xl bg-muted/60 p-3">
																	<p class="text-sm font-medium">{summary.title}</p>
																	<ul
																		class="mt-2 space-y-1 text-sm leading-5 text-muted-foreground"
																	>
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
																<Confirmation.Actions class="justify-start">
																	<Confirmation.Action
																		disabled={approving}
																		onclick={() => respondToApproval(approval.approvalId, true)}
																	>
																		{approving ? 'Responding…' : 'Approve update'}
																	</Confirmation.Action>
																	<Confirmation.Action
																		variant="outline"
																		disabled={approving}
																		onclick={() => respondToApproval(approval.approvalId, false)}
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
															'size-4 shrink-0 text-muted-foreground',
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
																			class="size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
																			aria-hidden="true"
																		/>
																	{:else if activity.state === 'error'}
																		<CircleAlertIcon
																			class="size-3.5 shrink-0 text-destructive"
																			aria-hidden="true"
																		/>
																	{/if}
																	<ActivityIcon
																		class="size-3.5 shrink-0 text-muted-foreground"
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
												<Message.Action
													tooltip="Helpful response"
													label="Helpful response"
													aria-pressed={messageFeedback(message.id) === 'helpful'}
													class={cn(
														messageFeedback(message.id) === 'helpful' && 'bg-muted text-foreground'
													)}
													onclick={() => toggleMessageFeedback(message.id, 'helpful')}
												>
													{#if messageFeedback(message.id) === 'helpful'}
														<ThumbUpFilledIcon />
													{:else}
														<ThumbUpIcon />
													{/if}
												</Message.Action>
												<Message.Action
													tooltip="Not helpful response"
													label="Not helpful response"
													aria-pressed={messageFeedback(message.id) === 'not_helpful'}
													class={cn(
														messageFeedback(message.id) === 'not_helpful' &&
															'bg-muted text-foreground'
													)}
													onclick={() => toggleMessageFeedback(message.id, 'not_helpful')}
												>
													{#if messageFeedback(message.id) === 'not_helpful'}
														<ThumbDownFilledIcon />
													{:else}
														<ThumbDownIcon />
													{/if}
												</Message.Action>
											</Message.Actions>
										{/if}
									{/if}
								</Message.Root>
							{/each}
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
				<PromptInput.Root
					class="rounded-[24px] border border-border/70 bg-background shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow] focus-within:border-border focus-within:shadow-[0_6px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.28)] dark:focus-within:shadow-[0_6px_20px_rgba(0,0,0,0.36)]"
					onSubmit={({ text }) => send(text)}
					clearOnSubmit={false}
				>
					{#if selectedCoachActionIds.length}
						<PromptInput.Header class="px-2.5 pt-2">
							{#each selectedCoachActionIds as actionId (actionId)}
								{@const action = coachComposerActions.find((item) => item.id === actionId)}
								{@const Icon = coachActionIcons[actionId]}
								{#if action}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
									>
										<Icon class="size-3.5 text-muted-foreground" aria-hidden="true" />
										{action.title}
										<button
											type="button"
											class="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
											aria-label={`Remove ${action.title}`}
											onclick={() => removeCoachAction(actionId)}
										>
											<XIcon class="size-3" aria-hidden="true" />
										</button>
									</span>
								{/if}
							{/each}
						</PromptInput.Header>
					{/if}
					<div class="flex items-end gap-1 p-1.5">
						<PromptInput.ActionMenu bind:open={coachActionsOpen}>
							<PromptInput.ActionMenuTrigger
								class="size-9 shrink-0 self-end rounded-full text-muted-foreground hover:text-foreground"
								disabled={!sessionId || streaming}
								aria-label="Coach actions"
							/>
							<PromptInput.ActionMenuContent
								align="start"
								sideOffset={8}
								class="w-[min(18rem,calc(100vw-2rem))] p-1"
							>
								{#each coachComposerActions as action (action.id)}
									{@const Icon = coachActionIcons[action.id]}
									{@const selected = selectedCoachActionIds.includes(action.id)}
									<PromptInput.ActionMenuItem
										class={cn('items-start gap-3 rounded-lg px-2.5 py-2', selected && 'bg-muted')}
										disabled={!sessionId || streaming}
										onSelect={() => toggleCoachAction(action.id)}
									>
										<Icon class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
										<div class="min-w-0 flex-1 text-left">
											<div class="text-sm leading-5 font-medium">{action.title}</div>
											<div class="text-xs leading-4 text-muted-foreground">
												{action.description}
											</div>
										</div>
									</PromptInput.ActionMenuItem>
								{/each}
							</PromptInput.ActionMenuContent>
						</PromptInput.ActionMenu>
						<PromptInput.Body class="min-w-0 flex-1">
							<PromptInput.Textarea
								bind:ref={composerInputRef}
								bind:value={input}
								placeholder="Ask Coach"
								class="text-md md:text-md min-h-9 px-0 py-1.5 leading-6 placeholder:text-muted-foreground/80"
							/>
						</PromptInput.Body>
						<Select.Root
							type="single"
							value={thinkingMode}
							onValueChange={(value) => {
								if (value) thinkingMode = value as CoachThinkingMode;
							}}
						>
							<Select.Trigger
								class="h-9 shrink-0 gap-1 self-end border-transparent bg-transparent px-2 text-sm text-muted-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent dark:hover:bg-muted/50 [&>svg:last-child]:size-3.5 [&>svg:last-child]:opacity-60"
								disabled={!sessionId || streaming}
								aria-label="Coach response depth"
							>
								{@const Icon = selectedThinkingMode.icon}
								<Icon class="size-3.5 shrink-0" aria-hidden="true" />
								<span>{selectedThinkingMode.label}</span>
							</Select.Trigger>
							<Select.Content align="end" class="min-w-[10.5rem]">
								{#each thinkingModeOptions as option (option.value)}
									{@const Icon = option.icon}
									<Select.Item value={option.value}>
										<Icon class="size-4 text-muted-foreground" aria-hidden="true" />
										{option.label}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<PromptInput.Submit
							status={coach.status as ChatStatus}
							disabled={!canSendComposer && !streaming}
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
						Coach is powered by AI and can make mistakes.
					</p>
				{/if}
			{/if}
		</div>
	</div>
</div>
