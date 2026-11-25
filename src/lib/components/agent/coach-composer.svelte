<script lang="ts">
	import { onMount, tick, type Component } from 'svelte';

	import type { ChatStatus, FileUIPart } from 'ai';
	import {
		COACH_ATTACHMENT_ACCEPT,
		COACH_ATTACHMENT_MAX_BYTES
	} from '#lib/agent/attachments/images.js';

	import BarChart3Icon from '@tabler/icons-svelte/icons/chart-pie-filled';
	import Atom2FilledIcon from '@tabler/icons-svelte/icons/atom-2-filled';
	import BookOpenIcon from '@tabler/icons-svelte/icons/book-filled';
	import CalendarDaysIcon from '@tabler/icons-svelte/icons/calendar-event';

	import CoachDictation from './coach-dictation.svelte';
	import ArrowUpIcon from '@tabler/icons-svelte/icons/arrow-up';

	import SquareIcon from '@tabler/icons-svelte/icons/square-filled';
	import BoltFilledIcon from '@tabler/icons-svelte/icons/bolt-filled';
	import Sparkles2FilledIcon from '@tabler/icons-svelte/icons/sparkles-2-filled';
	import BrainIcon from '@tabler/icons-svelte/icons/brain';

	import * as PromptInput from '#lib/components/ai-elements/prompt-input/index.js';

	import * as Select from '#lib/components/ui/select/index.js';

	import {
		coachComposerActions,
		type CoachComposerActionId
	} from '#lib/agent/personalization/composer-actions.js';
	import type { CoachThinkingMode } from '#lib/agent/request.js';
	import { cn } from '#lib/utils.js';

	import { toast } from 'svelte-sonner';
	import IconX from '@tabler/icons-svelte/icons/x';

	let {
		input = $bindable(''),
		attachments = $bindable([]),
		selectedCoachActionIds = $bindable([]),
		thinkingMode = $bindable('quick'),
		composerInputRef = $bindable(null),
		sessionId,
		streaming,
		pendingQuestion,
		imageInputEnabled,
		status,
		send,
		onStop,
		replyPreview = null,
		onClearReply
	}: {
		input?: string;
		attachments?: PromptInput.PromptInputAttachmentData[];
		selectedCoachActionIds?: CoachComposerActionId[];
		thinkingMode?: CoachThinkingMode;
		composerInputRef?: HTMLTextAreaElement | null;
		sessionId: string;
		streaming: boolean;
		pendingQuestion: boolean;
		imageInputEnabled: boolean;
		status: ChatStatus;
		send: (text: string, files?: FileUIPart[]) => Promise<void>;
		onStop: () => void;
		replyPreview?: { role: 'user' | 'assistant'; content: string } | null;
		onClearReply?: () => void;
	} = $props();
	let coachActionsOpen = $state(false);
	let dictating = $state(false);
	let dictationPrefix = '';
	const asIcon = (icon: unknown) => icon as Component;
	let canSendComposer = $derived(
		Boolean(sessionId) &&
			!streaming &&
			!pendingQuestion &&
			(input.trim().length > 0 ||
				selectedCoachActionIds.length > 0 ||
				(imageInputEnabled && attachments.length > 0))
	);
	const coachActionIcons: Record<CoachComposerActionId, Component> = {
		'study-next': asIcon(BookOpenIcon),
		'study-plan': asIcon(CalendarDaysIcon),
		'review-progress': asIcon(BarChart3Icon),
		'physics-sim': asIcon(Atom2FilledIcon)
	};

	const coachActionColors: Record<CoachComposerActionId, string> = {
		'study-next': 'text-emerald-600 dark:text-emerald-400',
		'study-plan': 'text-blue-600 dark:text-blue-400',
		'review-progress': 'text-amber-600 dark:text-amber-400',
		'physics-sim': 'text-violet-600 dark:text-violet-400'
	};

	onMount(() => {
		function handleChipBackspace(event: KeyboardEvent) {
			if (
				event.target === composerInputRef &&
				!event.isComposing &&
				event.key === 'Backspace' &&
				composerInputRef?.selectionStart === 0 &&
				composerInputRef.selectionEnd === 0 &&
				selectedCoachActionIds.length
			) {
				event.preventDefault();
				event.stopImmediatePropagation();
				removeCoachAction(selectedCoachActionIds[selectedCoachActionIds.length - 1]);
			}
		}
		window.addEventListener('keydown', handleChipBackspace, true);
		return () => window.removeEventListener('keydown', handleChipBackspace, true);
	});

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
</script>

<PromptInput.Root
	class="w-full max-h-[300px] overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none"
	onSubmit={({ text, files }) => {
		if (!dictating) return send(text, files);
	}}
	bind:attachments
	accept={imageInputEnabled ? COACH_ATTACHMENT_ACCEPT : 'application/x-disabled'}
	maxFiles={imageInputEnabled ? 1 : 0}
	maxFileSize={COACH_ATTACHMENT_MAX_BYTES}
	onError={({ message }) => toast.error(message)}
	clearOnSubmit={false}
>
	{#if replyPreview}
		<div class="mb-1.5 flex items-center gap-2 px-3">
			<div class="min-w-0 flex-1">
				<p class="text-[13px] leading-tight font-semibold text-primary">
					Replying to {replyPreview.role === 'user' ? 'You' : 'Pip'}
				</p>
				<p class="truncate text-[12px] leading-tight text-muted-foreground">
					{replyPreview.content}
				</p>
			</div>
			<button
				type="button"
				class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
				aria-label="Cancel reply"
				onclick={() => onClearReply?.()}
			>
				<IconX class="size-3.5" />
			</button>
		</div>
	{/if}
	{#if attachments.length}
		<PromptInput.Attachments class="mb-2 px-1">
			{#snippet children(attachment)}<PromptInput.Attachment data={attachment} />{/snippet}
		</PromptInput.Attachments>
	{/if}
	<div
		class="flex w-full items-end gap-1 rounded-[21px] border border-border bg-background/95 p-1 shadow-none backdrop-blur-md"
	>
		<PromptInput.Tools class="shrink-0 gap-0 [&_button:first-child]:rounded-full">
			<PromptInput.ActionMenu bind:open={coachActionsOpen}>
				<PromptInput.ActionMenuTrigger
					class="size-8 shrink-0 rounded-full p-0 text-foreground shadow-none hover:bg-muted"
					disabled={!sessionId || streaming}
					aria-label="Pip actions"
				/>
				<PromptInput.ActionMenuContent
					align="start"
					sideOffset={8}
					class="w-[min(18rem,calc(100vw-2rem))] p-1"
				>
					{#if imageInputEnabled}<PromptInput.ActionAddAttachments label="Add file" />{/if}
					{#each ['physics-sim', 'study-plan'] as const as actionId (actionId)}
						{@const Icon = coachActionIcons[actionId]}
						{@const selected = selectedCoachActionIds.includes(actionId)}
						{@const action = coachComposerActions.find((item) => item.id === actionId)}
						<PromptInput.ActionMenuItem
							class={cn('items-center gap-2 rounded-lg px-2.5 py-2', selected && 'bg-muted')}
							disabled={!sessionId || streaming}
							onSelect={() => toggleCoachAction(actionId)}
						>
							<Icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<span class="text-sm">{action?.title}</span>
						</PromptInput.ActionMenuItem>
					{/each}
				</PromptInput.ActionMenuContent>
			</PromptInput.ActionMenu>
		</PromptInput.Tools>
		<div class="flex min-w-0 flex-1 items-end gap-1">
			{#each selectedCoachActionIds as actionId (actionId)}
				{@const action = coachComposerActions.find((item) => item.id === actionId)}
				{@const Icon = coachActionIcons[actionId]}
				{#if action}
					<button
						type="button"
						class={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm font-medium transition-colors hover:bg-muted ${coachActionColors[actionId]}`}
						aria-label={`Remove ${action.title}`}
						onclick={() => removeCoachAction(actionId)}
					>
						<Icon class="size-4" aria-hidden="true" />
						{actionId === 'physics-sim'
							? 'Simulation'
							: actionId === 'study-plan'
								? 'Study Plan'
								: action.title}
					</button>
				{/if}
			{/each}
			<PromptInput.Textarea
				bind:ref={composerInputRef}
				bind:value={input}
				placeholder="Ask Pip"
				rows={1}
				disabled={!sessionId || streaming || pendingQuestion || dictating}
				class="field-sizing-content max-h-32 min-h-0 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-md leading-5 outline-none placeholder:text-muted-foreground/70"
			/>
		</div>
		<div class="flex shrink-0 items-center gap-1">
			<Select.Root
				type="single"
				value={thinkingMode}
				onValueChange={(value) => {
					if (value) thinkingMode = value as CoachThinkingMode;
				}}
			>
				<Select.Trigger
					class="h-8 shrink-0 gap-1 rounded-full border-transparent bg-transparent px-2 text-sm text-muted-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent dark:hover:bg-muted/50 [&>svg:last-child]:size-3.5 [&>svg:last-child]:opacity-60"
					disabled={!sessionId || streaming}
					aria-label="Pip response depth"
				>
					{@const Icon = selectedThinkingMode.icon}
					<Icon class="size-3.5 shrink-0" aria-hidden="true" />
					<span class="max-sm:sr-only">{selectedThinkingMode.label}</span>
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
			<CoachDictation
				disabled={!sessionId || pendingQuestion || streaming}
				bind:busy={dictating}
				onStart={() => {
					dictationPrefix = input;
				}}
				onText={(text) => {
					input = dictationPrefix
						? dictationPrefix + (/\s$/.test(dictationPrefix) ? '' : ' ') + text
						: text;
				}}
				onFinish={() => {
					void tick().then(() => composerInputRef?.focus());
				}}
			/>
			<PromptInput.Submit
				{status}
				size="icon-sm"
				disabled={dictating || (!canSendComposer && !streaming)}
				{onStop}
				class={cn(
					'size-8 shrink-0 rounded-full p-0 shadow-none',
					canSendComposer || streaming
						? 'bg-foreground text-background hover:bg-foreground/85'
						: 'border-0 bg-muted text-muted-foreground hover:bg-muted'
				)}
			>
				{#if streaming}
					<SquareIcon class="size-4" />
				{:else}
					<ArrowUpIcon class="size-4" />
				{/if}
			</PromptInput.Submit>
		</div>
	</div>
</PromptInput.Root>
