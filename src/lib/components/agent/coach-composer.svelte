<script lang="ts">
	import { onMount, tick, type Component } from 'svelte';

	import type { ChatStatus, FileUIPart } from 'ai';
	import { COACH_IMAGE_MAX_BYTES, COACH_IMAGE_TYPES } from '$lib/agent/attachments/images';

	import BarChart3Icon from '@tabler/icons-svelte/icons/chart-pie-filled';
	import Atom2FilledIcon from '@tabler/icons-svelte/icons/atom-2-filled';
	import BookOpenIcon from '@tabler/icons-svelte/icons/book-filled';
	import CalendarDaysIcon from '@tabler/icons-svelte/icons/calendar-event';

	import ArrowUpIcon from '@tabler/icons-svelte/icons/arrow-up';

	import SquareIcon from '@tabler/icons-svelte/icons/square-filled';
	import BoltFilledIcon from '@tabler/icons-svelte/icons/bolt-filled';
	import Sparkles2FilledIcon from '@tabler/icons-svelte/icons/sparkles-2-filled';
	import BrainIcon from '@tabler/icons-svelte/icons/brain';

	import * as PromptInput from '$lib/components/ai-elements/prompt-input/index.js';

	import * as Select from '$lib/components/ui/select/index.js';

	import {
		coachComposerActions,
		type CoachComposerActionId
	} from '$lib/agent/personalization/composer-actions';
	import type { CoachThinkingMode } from '$lib/agent/request';
	import { SUPER_GRADIENT_BUTTON_CLASS } from '$lib/components/agent/ui';
	import { cn } from '$lib/utils.js';

	import { toast } from 'svelte-sonner';

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
		onStop
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
	} = $props();
	let coachActionsOpen = $state(false);
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
	class="relative flex max-h-[300px] min-h-[80px] flex-col gap-3 rounded-[24px] border border-black/8 bg-background pt-3 pb-2 shadow-[0_12px_32px_0_rgba(0,0,0,0.02)] transition-all dark:border-border"
	onSubmit={({ text, files }) => send(text, files)}
	bind:attachments
	accept={imageInputEnabled ? COACH_IMAGE_TYPES.join(',') : 'application/x-disabled'}
	maxFiles={imageInputEnabled ? 1 : 0}
	maxFileSize={COACH_IMAGE_MAX_BYTES}
	onError={({ message }) => toast.error(message)}
	clearOnSubmit={false}
>
	{#if attachments.length}
		<PromptInput.Attachments class="px-3">
			{#snippet children(attachment)}<PromptInput.Attachment data={attachment} />{/snippet}
		</PromptInput.Attachments>
	{/if}
	<PromptInput.Body class="flex-1 ps-4 pe-2">
		<div class="flex items-start gap-2">
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
				disabled={!sessionId || streaming || pendingQuestion}
				class="text-md min-h-[32px] min-w-0 flex-1 resize-none overflow-auto px-0 py-0 leading-6 placeholder:text-muted-foreground/70"
			/>
		</div>
	</PromptInput.Body>
	<PromptInput.Toolbar class="gap-2 px-2 py-0">
		<PromptInput.Tools class="gap-1.5 [&_button:first-child]:rounded-full">
			<PromptInput.ActionMenu bind:open={coachActionsOpen}>
				<PromptInput.ActionMenuTrigger
					class="size-8 rounded-full p-0 text-foreground shadow-none hover:bg-muted"
					disabled={!sessionId || streaming}
					aria-label="Pip actions"
				/>
				<PromptInput.ActionMenuContent
					align="start"
					sideOffset={8}
					class="w-[min(18rem,calc(100vw-2rem))] p-1"
				>
					{#if imageInputEnabled}<PromptInput.ActionAddAttachments label="Add image" />{/if}
					{#each ['physics-sim', 'study-plan'] as const as actionId (actionId)}
						{@const Icon = coachActionIcons[actionId]}
						{@const selected = selectedCoachActionIds.includes(actionId)}
						<PromptInput.ActionMenuItem
							class={cn('items-center gap-2 rounded-lg px-2.5 py-2', selected && 'bg-muted')}
							disabled={!sessionId || streaming}
							onSelect={() => toggleCoachAction(actionId)}
						>
							<Icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<span class="text-sm"
								>{actionId === 'physics-sim' ? 'Create Simulation' : 'Study plan'}</span
							>
						</PromptInput.ActionMenuItem>
					{/each}
				</PromptInput.ActionMenuContent>
			</PromptInput.ActionMenu>
		</PromptInput.Tools>
		<div class="flex items-center gap-2">
			<Select.Root
				type="single"
				value={thinkingMode}
				onValueChange={(value) => {
					if (value) thinkingMode = value as CoachThinkingMode;
				}}
			>
				<Select.Trigger
					class="h-8 shrink-0 gap-1 rounded-full border-transparent bg-transparent px-2.5 text-sm text-muted-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent dark:hover:bg-muted/50 [&>svg:last-child]:size-3.5 [&>svg:last-child]:opacity-60"
					disabled={!sessionId || streaming}
					aria-label="Pip response depth"
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
				{status}
				size="icon-sm"
				disabled={!canSendComposer && !streaming}
				{onStop}
				class={cn(
					'size-8 rounded-full p-0 shadow-none',
					canSendComposer || streaming
						? SUPER_GRADIENT_BUTTON_CLASS
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
	</PromptInput.Toolbar>
</PromptInput.Root>
