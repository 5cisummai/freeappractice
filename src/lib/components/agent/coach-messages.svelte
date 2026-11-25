<script lang="ts">
	import StepSearchIcon from '@lucide/svelte/icons/search';
	import StepPencilIcon from '@lucide/svelte/icons/pencil';
	import StepBrainIcon from '@lucide/svelte/icons/brain';
	import StepBookIcon from '@lucide/svelte/icons/book-open';
	import StepUnitIcon from '@lucide/svelte/icons/book-marked';
	import StepPlanIcon from '@lucide/svelte/icons/calendar-days';
	import StepProgressIcon from '@lucide/svelte/icons/chart-no-axes-combined';
	import StepQuizIcon from '@lucide/svelte/icons/clipboard-check';
	import StepQuestionIcon from '@lucide/svelte/icons/clipboard-list';
	import StepProfileIcon from '@lucide/svelte/icons/user-round';
	import StepGoalsIcon from '@lucide/svelte/icons/target';
	import StepDiagramIcon from '@lucide/svelte/icons/image';
	import StepActivityIcon from '@lucide/svelte/icons/activity';
	import StepSigmaIcon from '@lucide/svelte/icons/sigma';
	import StepFallbackIcon from '@lucide/svelte/icons/wrench';
	import CopyIcon from '@tabler/icons-svelte/icons/copy';
	import ThumbDownFilledIcon from '@tabler/icons-svelte/icons/thumb-down-filled';
	import ThumbDownIcon from '@tabler/icons-svelte/icons/thumb-down';
	import ThumbUpFilledIcon from '@tabler/icons-svelte/icons/thumb-up-filled';
	import ThumbUpIcon from '@tabler/icons-svelte/icons/thumb-up';

	import RefreshCwIcon from '@tabler/icons-svelte/icons/refresh';
	import PaperclipIcon from '@tabler/icons-svelte/icons/paperclip';

	import * as ChainOfThought from '#lib/components/ai-elements/chain-of-thought/index.js';
	import { Shimmer } from '#lib/components/ai-elements/shimmer/index.js';

	import { tick } from 'svelte';
	import { backOut } from 'svelte/easing';
	import { fly, scale } from 'svelte/transition';

	import * as Message from '#lib/components/ui/message/index.js';
	import * as Bubble from '#lib/components/ui/bubble/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import CoachMessageBubbleMenu from '#lib/components/agent/coach-message-bubble-menu.svelte';

	import RichText from '#lib/components/content/rich-text.svelte';
	import { getCanvasHtmlOutput } from '#lib/canvas/canvas-ui.js';
	import CoachCanvasPanel from '#lib/components/agent/coach-canvas-panel.svelte';
	import { diagramDataUrl, getDiagramOutput } from '#lib/components/agent/diagram.js';
	import CoachPracticeQuestionCard from '#lib/components/agent/coach-practice-question-card.svelte';
	import CoachPracticeQuestionResult from '#lib/components/agent/coach-practice-question-result.svelte';

	import CoachAvatar from '#lib/components/agent/coach-avatar.svelte';
	import {
		COACH_AVATAR_MONTAGES,
		COACH_AVATAR_STATES
	} from '#lib/components/agent/avatar/avatar-state.js';
	import {
		getCoachPracticeQuestionToolOutput,
		getCoachPracticeQuestionAssignment,
		isCoachPracticeQuestionPending,
		type CoachPracticeQuestionToolOutput,
		type CoachPracticeQuestionOutput
	} from '#lib/agent/tools/practice.js';
	import type { AgentUIMessage } from '#lib/agent/agent.server.js';
	import { isCoachTextMediaType, resolveCoachTextMediaType } from '#lib/agent/attachments/text.js';

	import { cn } from '#lib/utils.js';
	import type { ToolUIPartApproval } from '#lib/components/ai-elements/confirmation/confirmation-context.svelte.js';

	let {
		messages,
		streaming,
		composerHasText,
		messageFeedbackById,
		regenerateMessage,
		copyMessage,
		toggleMessageFeedback,
		openNotHelpfulFeedback,
		submitPracticeQuestionResult,
		conversationId,
		persistPracticeQuestionAssignment,
		replyToId = $bindable()
	}: {
		messages: AgentUIMessage[];
		streaming: boolean;
		composerHasText: boolean;
		messageFeedbackById: Record<string, 'helpful' | 'not_helpful'>;
		regenerateMessage: (id: string) => Promise<void>;
		copyMessage: (message: AgentUIMessage) => Promise<void>;
		toggleMessageFeedback: (id: string, feedback: 'helpful' | 'not_helpful') => void;
		openNotHelpfulFeedback: (id: string) => void;
		submitPracticeQuestionResult: (
			id: string,
			output: CoachPracticeQuestionToolOutput
		) => Promise<boolean>;
		conversationId?: string;
		persistPracticeQuestionAssignment?: (
			toolCallId: string,
			assignedQuestion: CoachPracticeQuestionOutput
		) => Promise<boolean>;
		replyToId?: string;
	} = $props();
	function messageFeedback(id: string) {
		return messageFeedbackById[id];
	}
	const toolActivityLabels: Record<string, { running: string; complete: string }> = {
		'tool-search_web': {
			running: 'Searching the web…',
			complete: 'Searched the web'
		},
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
		'tool-open_physics_sim': {
			running: 'Building a physics simulation…',
			complete: 'Opened a physics simulation'
		},
		'tool-open_math_explorer': {
			running: 'Building a math explorer…',
			complete: 'Opened a math explorer'
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
		},
		'tool-ask_student': {
			running: 'Waiting for your response…',
			complete: 'Got your response'
		}
	};

	const toolActivityIcons: Record<string, typeof StepSearchIcon> = {
		'tool-search_web': StepSearchIcon,
		'tool-read_course_catalog': StepBookIcon,
		'tool-read_current_question': StepQuestionIcon,
		'tool-read_profile': StepProfileIcon,
		'tool-read_progress_summary': StepProgressIcon,
		'tool-read_quiz_attempt': StepQuizIcon,
		'tool-read_study_plan': StepPlanIcon,
		'tool-read_activity_summary': StepActivityIcon,
		'tool-read_unit_detail': StepUnitIcon,
		'tool-read_frq_performance': StepProgressIcon,
		'tool-give_practice_question': StepQuestionIcon,
		'tool-ask_student': StepQuestionIcon,
		'tool-update_goals': StepGoalsIcon,
		'tool-update_study_plan': StepPlanIcon,
		'tool-generate_diagram': StepDiagramIcon,
		'tool-open_physics_sim': StepActivityIcon,
		'tool-open_math_explorer': StepSigmaIcon
	};

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
		reasoning?: string;
		sources: { title: string; url: string; hostname: string; faviconUrl: string }[];
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

	function messageText(message: AgentUIMessage): string {
		return message.parts
			.filter((part) => part.type === 'text')
			.map((part) => part.text)
			.join('\n');
	}

	function searchSources(part: CoachToolPart) {
		const results = part.type === 'tool-search_web' ? asRecord(part.output).results : null;
		if (!Array.isArray(results)) return [];
		return results.flatMap((result) => {
			const { sourceId, title, url } = asRecord(result);
			if (typeof url !== 'string') return [];
			try {
				const parsed = new URL(url);
				if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return [];
				return [
					{
						id: typeof sourceId === 'string' ? sourceId : undefined,
						title: typeof title === 'string' ? title : url,
						url,
						hostname: parsed.hostname.replace(/^www\./, ''),
						faviconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32`
					}
				];
			} catch {
				return [];
			}
		});
	}

	function messageCitations(message: AgentUIMessage) {
		return message.parts.flatMap((part) => {
			const tool = getToolPart(part);
			return tool
				? searchSources(tool).flatMap((source) =>
						source.id ? [{ id: source.id, url: source.url, title: source.title }] : []
					)
				: [];
		});
	}

	function getToolActivity(part: CoachToolPart, index: number): ToolActivity {
		const state =
			part.errorText || part.state === 'output-error'
				? 'error'
				: isToolInProgress(part.state)
					? 'running'
					: 'complete';
		const sources = searchSources(part);
		return {
			key: `${part.type}-${index}`,
			type: part.type,
			label: state === 'error' ? 'Could not finish this step' : toolActivityLabel(part.type, state),
			state,
			sources: sources.filter(
				(source, sourceIndex) =>
					sources.findIndex((candidate) => candidate.hostname === source.hostname) === sourceIndex
			)
		};
	}

	function getToolActivities(message: AgentUIMessage): ToolActivity[] {
		const activities: ToolActivity[] = [];
		message.parts.forEach((part, index) => {
			if (part.type === 'reasoning' && part.text.trim()) {
				activities.push({
					key: `reasoning-${index}`,
					type: 'reasoning',
					label: 'Thinking…',
					state: part.state === 'streaming' ? 'running' : 'complete',
					reasoning: part.text,
					sources: []
				});
				return;
			}
			const toolPart = getToolPart(part);
			if (!toolPart) return;
			const activity = getToolActivity(toolPart, index);
			const previous = activities.at(-1);
			if (
				previous?.type === activity.type &&
				previous.state !== 'error' &&
				activity.state !== 'error'
			) {
				previous.state =
					previous.state === 'running' || activity.state === 'running' ? 'running' : 'complete';
				previous.label = toolActivityLabel(previous.type, previous.state);
				for (const source of activity.sources) {
					if (!previous.sources.some((existing) => existing.hostname === source.hostname)) {
						previous.sources.push(source);
					}
				}
			} else {
				activities.push(activity);
			}
		});
		return activities;
	}

	function hasCompletedPracticeQuestion(message: AgentUIMessage): boolean {
		return message.parts.some((part) => {
			const toolPart = getToolPart(part);
			return Boolean(toolPart && getCoachPracticeQuestionToolOutput(toolPart.output));
		});
	}

	function isStreamingAnswer(message: AgentUIMessage, messageIndex: number): boolean {
		return (
			streaming && messageIndex === messages.length - 1 && messageText(message).trim().length > 0
		);
	}

	function activitySummary(activities: ToolActivity[]): string {
		const active = activities.find((activity) => activity.state === 'running');
		if (active) return active.label;
		if (activities.some((activity) => activity.state === 'error')) return 'Activity';
		if (activities.length === 1) return 'Completed 1 step';
		return `Completed ${activities.length} steps`;
	}

	function activityStateKey(message: AgentUIMessage): string {
		return `${message.id}:${messageText(message).trim() ? 'answer' : 'activity'}`;
	}

	function isActivityOpen(message: AgentUIMessage, messageIndex: number): boolean {
		return (
			activityOpen[activityStateKey(message)] ??
			(streaming && messageIndex === messages.length - 1 && !messageText(message).trim())
		);
	}

	function asRecord(value: unknown): Record<string, unknown> {
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	}

	function isCoachTextFilePart(
		part: AgentUIMessage['parts'][number]
	): part is Extract<AgentUIMessage['parts'][number], { type: 'file' }> {
		if (part.type !== 'file') return false;
		return isCoachTextMediaType(part.mediaType) || resolveCoachTextMediaType(part) !== null;
	}

	const BIG_RADIUS = 'rounded-[1.25rem]';
	const HEART = '❤️';
	const TIME_MARKER_GAP_MS = 60 * 60 * 1000;
	const reducedMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const entrance = { y: 10, delay: reducedMotion ? 0 : 100, duration: reducedMotion ? 0 : 240 };

	type ReplyQuote = { id: string; role: 'user' | 'assistant'; content: string };

	let reactionsById = $state<Record<string, string[]>>({});
	let replyQuoteById = $state<Record<string, ReplyQuote>>({});
	let firstSeenAt = $state<Record<string, number>>({});
	let pendingQuote = $state<ReplyQuote | null>(null);
	let lastUserMessageId = $state<string | undefined>(undefined);
	let messageHighlight: Animation | undefined;


	$effect(() => {
		const currentUserId = messages.findLast((message) => message.role === 'user')?.id;
		if (currentUserId && currentUserId !== lastUserMessageId && pendingQuote) {
			replyQuoteById = { ...replyQuoteById, [currentUserId]: pendingQuote };
			pendingQuote = null;
			replyToId = undefined;
		}
		lastUserMessageId = currentUserId;
	});

	$effect(() => {
		if (!replyToId) pendingQuote = null;
	});

	function messageTimestamp(message: AgentUIMessage): number {
		const createdAt = (message as { createdAt?: Date }).createdAt;
		if (createdAt instanceof Date) return createdAt.getTime();
		const cached = firstSeenAt[message.id];
		if (cached != null) return cached;
		const now = Date.now();
		firstSeenAt[message.id] = now;
		return now;
	}

	function formatTimeMarker(ms: number): string {
		const date = new Date(ms);
		const today = new Date();
		const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
		const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
		const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
		const dayDiff = Math.round((startOfToday - startOfDay) / 86_400_000);

		if (dayDiff === 0) return `Today ${time}`;
		if (dayDiff === 1) return `Yesterday ${time}`;
		if (dayDiff > 1 && dayDiff < 7) {
			return `${date.toLocaleDateString(undefined, { weekday: 'long' })} ${time}`;
		}
		const datePart = date.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' })
		});
		return `${datePart} ${time}`;
	}

	function messageGroupBounds(messageIndex: number): {
		startsGroup: boolean;
		endsGroup: boolean;
		timeMarker: string | null;
		adjacentReply: boolean;
		followedByReply: boolean;
		senderChanged: boolean;
	} {
		const message = messages[messageIndex];
		const prev = messages[messageIndex - 1];
		const next = messages[messageIndex + 1];
		const reply = replyQuoteById[message.id];
		const nextReply = next ? replyQuoteById[next.id] : undefined;
		const adjacentReply = Boolean(prev && reply?.id === prev.id);
		const followedByReply = nextReply?.id === message.id;
		const showTimeMarker =
			!prev || messageTimestamp(message) - messageTimestamp(prev) >= TIME_MARKER_GAP_MS;
		return {
			startsGroup: showTimeMarker || Boolean(reply) || !prev || prev.role !== message.role,
			endsGroup:
				followedByReply ||
				Boolean(nextReply) ||
				messageIndex === messages.length - 1 ||
				next?.role !== message.role,
			timeMarker: showTimeMarker ? formatTimeMarker(messageTimestamp(message)) : null,
			adjacentReply,
			followedByReply,
			senderChanged: Boolean(prev && prev.role !== message.role)
		};
	}

	function toggleReaction(messageId: string, emoji: string) {
		const current = reactionsById[messageId] ?? [];
		reactionsById = {
			...reactionsById,
			[messageId]: current.includes(emoji)
				? current.filter((item) => item !== emoji)
				: [...current, emoji]
		};
	}

	function startReply(message: AgentUIMessage) {
		const content = messageText(message);
		pendingQuote = {
			id: message.id,
			role: message.role === 'user' ? 'user' : 'assistant',
			content
		};
		replyToId = message.id;
		void tick();
	}

	async function scrollToMessage(id: string) {
		await tick();
		const el = document.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
		if (!(el instanceof HTMLElement)) return;
		el.scrollIntoView({
			behavior: reducedMotion ? 'instant' : 'smooth',
			block: 'center'
		});
		messageHighlight?.cancel();
		messageHighlight = el.animate(
			[
				{ outline: '2px solid var(--ring)', outlineOffset: '2px' },
				{ outline: '2px solid var(--ring)', outlineOffset: '2px', offset: 0.8 },
				{ outline: '2px solid transparent', outlineOffset: '2px' }
			],
			{ duration: 1800, easing: reducedMotion ? 'steps(1, end)' : 'ease-out' }
		);
	}

	function bubbleShape(isUser: boolean, startsGroup: boolean, endsGroup: boolean): string {
		if (isUser) {
			return cn(
				BIG_RADIUS,
				!startsGroup && 'rounded-tr-[0.375rem]',
				!endsGroup && 'rounded-br-[0.375rem]'
			);
		}
		return cn(
			BIG_RADIUS,
			!startsGroup && 'rounded-tl-[0.375rem]',
			!endsGroup && 'rounded-bl-[0.375rem]'
		);
	}

	function bubbleFill(isUser: boolean): string {
		return isUser ? 'bg-primary! text-primary-foreground!' : 'bg-muted! text-foreground!';
	}

	function textPartIndices(message: AgentUIMessage): number[] {
		return message.parts.flatMap((part, index) =>
			part.type === 'text' && part.text.trim() ? [index] : []
		);
	}
</script>

{#snippet reactionBadge(isUser: boolean, reactions: string[])}
	{#if reactions.length > 0}
		<Bubble.Reactions side="bottom" align={isUser ? 'end' : 'start'}>
			{#each reactions as emoji (emoji)}
				<span
					class="inline-block"
					in:scale={{ duration: 350, start: 0.4, opacity: 0, easing: backOut }}>{emoji}</span
				>
			{/each}
		</Bubble.Reactions>
	{/if}
{/snippet}

{#each messages as message, messageIndex (message.id)}
	{@const groupBounds = messageGroupBounds(messageIndex)}
	{@const isUser = message.role === 'user'}
	{@const reactions = reactionsById[message.id] ?? []}
	{@const reply = replyQuoteById[message.id]}
	<div
		data-message-id={message.id}
		class={cn(
			'ph-mask-pii max-w-3xl',
			groupBounds.senderChanged && !groupBounds.timeMarker && 'pt-2',
			(reactions.length > 0 || reply || groupBounds.followedByReply) && 'overflow-visible'
		)}
	>
		{#if groupBounds.timeMarker}
			<p class="w-full py-3 text-center text-[11px] leading-4 font-medium text-muted-foreground">
				{groupBounds.timeMarker}
			</p>
		{/if}
		{#if reply && !groupBounds.adjacentReply}
			<div
				class={cn('mb-2 flex', !groupBounds.timeMarker && 'pt-1', reply.role === 'user' && 'justify-end')}
			>
				<button
					type="button"
					class="max-w-[75%] cursor-pointer rounded-2xl border border-muted-foreground/35 bg-background px-2.5 py-1 text-left text-xs leading-4 text-muted-foreground hover:border-muted-foreground"
					onclick={() => void scrollToMessage(reply.id)}
				>
					<span class="line-clamp-2 wrap-break-word">{reply.content}</span>
				</button>
			</div>
		{/if}
		<div class="relative">
			{#if reply}
				<div
					aria-hidden="true"
					class={[
						'pip-reply-connector',
						reply.role === 'user' && 'outgoing',
						groupBounds.adjacentReply && Boolean(groupBounds.timeMarker) && 'across-time',
						reply.role === message.role && 'same-side'
					]}
				></div>
			{/if}
			<Message.Root align={isUser ? 'end' : 'start'} class="max-w-3xl">
				{#if isUser}
					<Message.Content class="gap-1">
						<CoachMessageBubbleMenu
							messageId={message.id}
							outgoing
							content={messageText(message)}
							onReaction={(emoji) => toggleReaction(message.id, emoji)}
						>
							<Bubble.Root variant="default" align="end" class="max-w-full">
								<div class="relative" in:fly|global={entrance}>
									<Bubble.Content
										class={cn(
											'relative px-3.5 py-2 text-md leading-6 whitespace-pre-wrap',
											bubbleShape(true, groupBounds.startsGroup, groupBounds.endsGroup),
											bubbleFill(true)
										)}
										ondblclick={() => toggleReaction(message.id, HEART)}
									>
										{messageText(message)}
										{#each message.parts as part, partIndex (partIndex)}
											{#if part.type === 'file' && (part.url.startsWith('/api/coach/images/') || part.url.startsWith('data:image/'))}
												<img
													src={part.url}
													alt="Your attachment"
													class="mt-2 max-h-72 max-w-full rounded-xl object-contain"
												/>
											{:else if isCoachTextFilePart(part)}
												<span
													class="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1 text-sm text-muted-foreground"
												>
													<PaperclipIcon class="size-3.5 shrink-0" aria-hidden="true" />
													<span class="truncate">{part.filename?.trim() || 'Attached file'}</span>
												</span>
											{/if}
										{/each}
									</Bubble.Content>
									{@render reactionBadge(true, reactions)}
								</div>
							</Bubble.Root>
						</CoachMessageBubbleMenu>
					</Message.Content>
				{:else}
			{@const activities = getToolActivities(message)}
			{@const isCurrentAssistant = messageIndex === messages.length - 1}
			<Message.Avatar class="overflow-visible bg-transparent">
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
					label="Pip"
				/>
			</Message.Avatar>
			<Message.Content>
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
				{/if}
			{/each}
			{#if activities.length}
				<ChainOfThought.Root
					class="mt-3 max-w-3xl"
					open={isActivityOpen(message, messageIndex)}
					onOpenChange={(open) => (activityOpen[activityStateKey(message)] = open)}
				>
					<ChainOfThought.Header
						class="rounded-md py-1 font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						{#if isCurrentAssistant && activities.some((activity) => activity.state === 'running')}
							<Shimmer as="span" content_length={activitySummary(activities).length}>
								{activitySummary(activities)}
							</Shimmer>
						{:else}
							{activitySummary(activities)}
						{/if}
					</ChainOfThought.Header>
					<ChainOfThought.Content class="py-1">
						{#each activities as activity (activity.key)}
							<ChainOfThought.Step
								icon={activity.type === 'reasoning'
									? StepBrainIcon
									: (toolActivityIcons[activity.type] ??
										(activity.type.startsWith('tool-update_') ? StepPencilIcon : StepFallbackIcon))}
								label={activity.type === 'reasoning' ? undefined : activity.label}
								status={activity.state === 'running' ? 'active' : 'complete'}
								class={cn(
									activity.state === 'running' && 'animate-pulse motion-reduce:animate-none',
									activity.state === 'error' && 'text-destructive'
								)}
							>
								{#if activity.reasoning}
									<RichText
										text={activity.reasoning}
										blocks
										class="max-w-2xl text-sm leading-6 text-muted-foreground"
									/>
								{/if}
								{#if activity.sources.length}
									<ChainOfThought.SearchResults class="flex-wrap gap-1.5">
										{#each activity.sources as source (source.url)}
											<ChainOfThought.SearchResult
												href={source.url}
												target="_blank"
												rel="noopener noreferrer"
												title={source.title}
												class="max-w-full hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring"
											>
												<img
													src={source.faviconUrl}
													alt=""
													width="14"
													height="14"
													loading="lazy"
													referrerpolicy="no-referrer"
													class="size-3.5 rounded-sm object-contain"
													onerror={(event) =>
														((event.currentTarget as HTMLImageElement).hidden = true)}
												/>
												{source.hostname}
											</ChainOfThought.SearchResult>
										{/each}
									</ChainOfThought.SearchResults>
								{/if}
							</ChainOfThought.Step>
						{/each}
					</ChainOfThought.Content>
				</ChainOfThought.Root>
			{/if}
			{#each message.parts as part, index (`practice-${message.id}-${index}`)}
				{@const toolPart = getToolPart(part)}
				{#if toolPart?.type === 'tool-give_practice_question'}
					{@const practiceQuestionResult = getCoachPracticeQuestionToolOutput(toolPart.output)}
					{@const assignedQuestion = getCoachPracticeQuestionAssignment(toolPart)}
					{#if isCoachPracticeQuestionPending(toolPart) && toolPart.toolCallId}
						<CoachPracticeQuestionCard
							input={toolPart.input}
							toolCallId={toolPart.toolCallId}
							{conversationId}
							{assignedQuestion}
							onAssigned={persistPracticeQuestionAssignment
								? (question) => persistPracticeQuestionAssignment(toolPart.toolCallId!, question)
								: undefined}
							onResolve={(output) => submitPracticeQuestionResult(toolPart.toolCallId!, output)}
						/>
					{:else if practiceQuestionResult}
						<CoachPracticeQuestionResult result={practiceQuestionResult} />
					{/if}
				{/if}
			{/each}
			{#each message.parts as part, index (`canvas-${message.id}-${index}`)}
				{@const toolPart = getToolPart(part)}
				{#if toolPart && (toolPart.type === 'tool-open_physics_sim' || toolPart.type === 'tool-open_math_explorer')}
					{@const canvasArtifact = getCanvasHtmlOutput(toolPart.output)}
					{#if canvasArtifact}
						<CoachCanvasPanel artifact={canvasArtifact} />
					{/if}
				{/if}
			{/each}
				{@const textIndices = textPartIndices(message)}
				<CoachMessageBubbleMenu
					messageId={message.id}
					outgoing={false}
					content={messageText(message)}
					onReaction={(emoji) => toggleReaction(message.id, emoji)}
					onReply={() => startReply(message)}
					extraActions={[
						{
							label: 'Regenerate',
							disabled: streaming,
							onSelect: () => void regenerateMessage(message.id)
						}
					]}
				>
					<div class="relative" in:fly|global={entrance}>
						{#each message.parts as part, index (`text-${message.id}-${index}`)}
							{#if part.type === 'text' && part.text.trim()}
								{@const textIdx = textIndices.indexOf(index)}
								{@const partStarts = textIdx === 0 ? groupBounds.startsGroup : false}
								{@const partEnds =
									textIdx === textIndices.length - 1 ? groupBounds.endsGroup : false}
								<Bubble.Root variant="muted" align="start" class="max-w-full">
									<Bubble.Content
										class={cn(
											'relative px-3.5 py-2 text-md w-full max-w-3xl min-w-0 leading-7',
											bubbleShape(false, partStarts, partEnds),
											bubbleFill(false)
										)}
										ondblclick={() => toggleReaction(message.id, HEART)}
									>
										<RichText
											text={part.text}
											blocks
											citations={messages.slice(0, messageIndex + 1).flatMap(messageCitations)}
										/>
									</Bubble.Content>
								</Bubble.Root>
							{/if}
						{/each}
						{@render reactionBadge(false, reactions)}
					</div>
				</CoachMessageBubbleMenu>
				{#if messageText(message)}
					<Message.Footer
						class={cn(
							'mt-0 gap-0 transition-opacity',
							messageIndex === messages.length - 1
								? 'opacity-100'
								: 'opacity-0 group-focus-within/message:opacity-100 group-hover/message:opacity-100'
						)}
					>
						<Button
							variant="ghost"
							size="icon"
							type="button"
							class="size-7"
							disabled={streaming}
							aria-label="Regenerate response"
							title="Regenerate response"
							onclick={() => void regenerateMessage(message.id)}
						>
							<RefreshCwIcon />
							<span class="sr-only">Regenerate response</span>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							type="button"
							class="size-7"
							aria-label="Copy response"
							title="Copy response"
							onclick={() => void copyMessage(message)}
						>
							<CopyIcon />
							<span class="sr-only">Copy response</span>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							type="button"
							class={cn('size-7', messageFeedback(message.id) === 'helpful' && 'bg-muted text-foreground')}
							aria-label="Helpful response"
							title="Helpful response"
							aria-pressed={messageFeedback(message.id) === 'helpful'}
							onclick={() => toggleMessageFeedback(message.id, 'helpful')}
						>
							{#if messageFeedback(message.id) === 'helpful'}
								<ThumbUpFilledIcon />
							{:else}
								<ThumbUpIcon />
							{/if}
							<span class="sr-only">Helpful response</span>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							type="button"
							class={cn(
								'size-7',
								messageFeedback(message.id) === 'not_helpful' && 'bg-muted text-foreground'
							)}
							aria-label="Not helpful response"
							title="Not helpful response"
							aria-pressed={messageFeedback(message.id) === 'not_helpful'}
							onclick={() => openNotHelpfulFeedback(message.id)}
						>
							{#if messageFeedback(message.id) === 'not_helpful'}
								<ThumbDownFilledIcon />
							{:else}
								<ThumbDownIcon />
							{/if}
							<span class="sr-only">Not helpful response</span>
						</Button>
					</Message.Footer>
				{/if}
			</Message.Content>
				{/if}
			</Message.Root>
		</div>
		{#if reactions.length > 0}
			<div class="h-3" aria-hidden="true"></div>
		{/if}
	</div>
{/each}
