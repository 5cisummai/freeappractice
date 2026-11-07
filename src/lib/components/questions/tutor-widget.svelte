<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport, type UIMessage } from 'ai';
	import MessageSquareIcon from '@tabler/icons-svelte/icons/message-filled';
	import XIcon from '@tabler/icons-svelte/icons/x-filled';
	import SendHorizontalIcon from '@tabler/icons-svelte/icons/send-filled';
	import SparklesIcon from '@tabler/icons-svelte/icons/sparkles-filled';
	import RichText from '#lib/components/content/rich-text.svelte';
	import FirstUseHint from '#lib/components/onboarding/first-use-hint.svelte';
	import * as Message from '#lib/components/ai-elements/message/index.js';
	import { Shimmer } from '#lib/components/ai-elements/shimmer/index.js';
	import { cn } from '#lib/utils.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '#lib/client/api.js';
	import { capturePostHogEvent } from '#lib/client/posthog-analytics.js';
	import { toast } from 'svelte-sonner';

	type TutorWidgetProps = {
		course?: string;
		unit?: string;
		questionId?: string;
		frqQuestionId?: string;
		frqAttemptId?: string;
		topic?: string;
		showFirstUseHint?: boolean;
		embedded?: boolean;
	};

	let {
		course = '',
		unit = '',
		questionId = '',
		frqQuestionId = '',
		frqAttemptId = '',
		topic = '',
		showFirstUseHint = false,
		embedded = false
	}: TutorWidgetProps = $props();

	const uid = $props.id();

	const GREETING =
		"Hi! I'm here to help you understand this question. What would you like to know?";

	let isOpen = $state(false);
	let inputText = $state('');
	let lastUsageWarning = $state<number | null>(null);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let triggerEl: HTMLButtonElement | null = $state(null);
	let requestStartedAt = 0;

	// Drag state for the floating button
	let btnX = $state(0);
	let btnY = $state(0);
	let isDragging = $state(false);
	let hasDragged = $state(false);
	let dragOffsetX = 0;
	let dragOffsetY = 0;
	let dragStartX = 0;
	let dragStartY = 0;

	const BUTTON_SIZE = 48;
	const PANEL_WIDTH = 340;
	const PANEL_HEIGHT = 480;
	const VIEWPORT_MARGIN = 12;
	const DRAG_THRESHOLD = 6;
	const PANEL_GAP = 8;

	function messageText(message: UIMessage): string {
		return message.parts
			.filter((part) => part.type === 'text')
			.map((part) => part.text)
			.join('');
	}

	const tutor = new Chat<UIMessage>({
		messages: [
			{ id: crypto.randomUUID(), role: 'assistant', parts: [{ type: 'text', text: GREETING }] }
		],
		transport: new DefaultChatTransport<UIMessage>({
			api: '/api/tutor/chat',
			body: () => ({
				questionId: frqQuestionId || questionId,
				...(frqQuestionId && frqAttemptId ? { attemptId: frqAttemptId } : {})
			}),
			fetch: async (url, init) => {
				const response = await apiFetch(String(url), init);
				if (!response.ok) {
					const payload = await readJsonOrNull<{ error?: string }>(response);
					throw new Error(getResponseMessage(payload, 'The tutor is unavailable right now.'));
				}
				if (response.headers.get('X-Tutor-Personalization-Degraded') === '1') {
					toast.message(
						'Tutor memory is temporarily unavailable. This reply uses your current progress only.'
					);
				}
				showUsageWarning(response);
				return response;
			},
			prepareSendMessagesRequest: ({ body, messages, id, trigger, messageId }) => ({
				api: frqQuestionId ? '/api/tutor/frq' : '/api/tutor/chat',
				body: { ...body, id, messages, trigger, messageId }
			})
		}),
		onError: (error) => {
			if (!requestStartedAt) return;
			if (error instanceof Error && error.name === 'AbortError') {
				requestStartedAt = 0;
				return;
			}
			capturePostHogEvent('tutor_response_failed', {
				question_id: questionId || undefined,
				course,
				unit,
				topic: topic || undefined,
				failure_kind: 'request_failed',
				response_time_ms: Date.now() - requestStartedAt
			});
			requestStartedAt = 0;
			toast.error(error instanceof Error ? error.message : 'The tutor is unavailable right now.');
		},
		onFinish: ({ isAbort, isError }) => {
			if (!requestStartedAt || isAbort || isError) return;
			capturePostHogEvent('tutor_response_completed', {
				question_id: questionId || undefined,
				course,
				unit,
				topic: topic || undefined,
				response_time_ms: Date.now() - requestStartedAt,
				conversation_turn: tutor.messages.filter((message) => message.role === 'user').length
			});
			requestStartedAt = 0;
		}
	});

	let isStreaming = $derived(tutor.status === 'submitted' || tutor.status === 'streaming');
	const scrollTrigger = $derived.by(() => {
		const lastMessage = tutor.messages.at(-1);
		return `${tutor.messages.length}:${lastMessage ? messageText(lastMessage).length : 0}`;
	});

	function clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

	function clampButtonPosition(x: number, y: number) {
		if (!viewportWidth || !viewportHeight) return { x, y };
		const maxX = Math.max(VIEWPORT_MARGIN, viewportWidth - BUTTON_SIZE - VIEWPORT_MARGIN);
		const maxY = Math.max(VIEWPORT_MARGIN, viewportHeight - BUTTON_SIZE - VIEWPORT_MARGIN);
		return {
			x: clamp(x, VIEWPORT_MARGIN, maxX),
			y: clamp(y, VIEWPORT_MARGIN, maxY)
		};
	}

	const panelWidth = $derived.by(() => {
		if (!viewportWidth) return PANEL_WIDTH;
		return Math.min(PANEL_WIDTH, Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2));
	});

	const panelHeight = $derived.by(() => {
		if (!viewportHeight) return PANEL_HEIGHT;
		return Math.min(PANEL_HEIGHT, Math.max(0, viewportHeight - VIEWPORT_MARGIN * 2));
	});

	const panelLeft = $derived.by(() => {
		if (!viewportWidth) return VIEWPORT_MARGIN;
		const preferredLeft = btnX + BUTTON_SIZE - panelWidth;
		return clamp(preferredLeft, VIEWPORT_MARGIN, viewportWidth - panelWidth - VIEWPORT_MARGIN);
	});

	const chatAbove = $derived.by(() => {
		if (!viewportHeight) return true;
		const availableAbove = btnY - PANEL_GAP;
		const availableBelow = viewportHeight - (btnY + BUTTON_SIZE + PANEL_GAP);
		return availableAbove >= panelHeight || availableAbove >= availableBelow;
	});

	const panelTop = $derived.by(() => {
		if (!viewportHeight) return VIEWPORT_MARGIN;
		const aboveTop = btnY - PANEL_GAP - panelHeight;
		const belowTop = btnY + BUTTON_SIZE + PANEL_GAP;
		const preferredTop = chatAbove ? aboveTop : belowTop;
		return clamp(preferredTop, VIEWPORT_MARGIN, viewportHeight - panelHeight - VIEWPORT_MARGIN);
	});

	function invalidateActiveStream() {
		void tutor.stop();
	}

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);

		return () => node.remove();
	}

	function autofocusInput(node: HTMLTextAreaElement) {
		const frame = requestAnimationFrame(() => node.focus());

		return () => cancelAnimationFrame(frame);
	}

	function autoScrollMessages(_trigger: string) {
		return (node: HTMLDivElement) => {
			const frame = requestAnimationFrame(() => {
				node.scrollTop = node.scrollHeight;
			});
			return () => cancelAnimationFrame(frame);
		};
	}

	function handleOpen() {
		isOpen = true;
	}

	function handleClose() {
		const wasOpen = isOpen;
		isOpen = false;
		invalidateActiveStream();
		if (wasOpen) {
			requestAnimationFrame(() => triggerEl?.focus());
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

	function trapPanelFocus(node: HTMLElement) {
		const getFocusable = () =>
			Array.from(
				node.querySelectorAll<HTMLElement>(
					'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
				)
			).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Tab') return;
			const focusable = getFocusable();
			if (focusable.length === 0) {
				event.preventDefault();
				node.focus();
				return;
			}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			const active = document.activeElement as HTMLElement | null;
			if (event.shiftKey && (active === first || active === node)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		};

		node.addEventListener('keydown', onKeyDown);
		return () => node.removeEventListener('keydown', onKeyDown);
	}

	function rememberTrigger(node: HTMLButtonElement) {
		triggerEl = node;
		return () => {
			if (triggerEl === node) triggerEl = null;
		};
	}

	async function sendMessage() {
		const text = inputText.trim();
		if (!text || isStreaming) return;
		inputText = '';
		requestStartedAt = Date.now();
		try {
			await tutor.sendMessage({ text });
		} catch {
			// onError handles user-visible failures.
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function autoResize(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = Math.min(el.scrollHeight, 80) + 'px';
	}

	function onBtnPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		isDragging = true;
		hasDragged = false;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragOffsetX = e.clientX - btnX;
		dragOffsetY = e.clientY - btnY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onBtnPointerMove(e: PointerEvent) {
		if (!isDragging) return;
		if (!hasDragged && Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) < DRAG_THRESHOLD)
			return;
		hasDragged = true;
		const clamped = clampButtonPosition(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
		btnX = clamped.x;
		btnY = clamped.y;
	}

	function onBtnPointerUp() {
		isDragging = false;
	}

	function onBtnPointerCancel() {
		isDragging = false;
		hasDragged = false;
	}

	onMount(() => {
		if (embedded) {
			handleOpen();
			return;
		}

		const updateViewport = () => {
			viewportWidth = window.innerWidth;
			viewportHeight = window.innerHeight;
			const clamped = clampButtonPosition(btnX, btnY);
			btnX = clamped.x;
			btnY = clamped.y;
		};

		viewportWidth = window.innerWidth;
		viewportHeight = window.innerHeight;
		btnX = viewportWidth - BUTTON_SIZE - VIEWPORT_MARGIN;
		btnY = viewportHeight - BUTTON_SIZE - VIEWPORT_MARGIN;

		window.addEventListener('resize', updateViewport);
		return () => {
			window.removeEventListener('resize', updateViewport);
		};
	});

	onDestroy(() => {
		invalidateActiveStream();
		void tutor.dispose();
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (!embedded && isOpen && event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	}}
/>

{#snippet chatBody()}
	<div class="flex shrink-0 items-center justify-between border-border px-4 py-3">
		<div class="flex items-center gap-2">
			<SparklesIcon class="h-4 w-4" />
			<span id="{uid}-title" class="text-sm font-semibold">Tutor</span>
		</div>
		{#if !embedded}
			<button
				onclick={handleClose}
				class="rounded-md p-0.5 transition-colors hover:bg-primary-foreground/10"
				aria-label="Close AI Tutor"
			>
				<XIcon class="h-4 w-4" />
			</button>
		{/if}
	</div>

	<div
		{@attach autoScrollMessages(scrollTrigger)}
		class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
	>
		{#if tutor.messages.length === 0}
			<div class="flex items-center justify-center py-6 text-sm text-muted-foreground">
				<span>Loading...</span>
			</div>
		{/if}
		{#each tutor.messages as message, i (message.id)}
			{@const content = messageText(message)}
			<Message.Root
				from={message.role}
				class={cn(
					'ph-mask-pii w-full max-w-full min-w-0',
					message.role === 'user' && 'max-w-[92%]'
				)}
			>
				<Message.Content
					class={cn(
						message.role === 'user' && 'text-sm leading-5',
						message.role === 'assistant' && 'max-w-[95%] text-sm leading-6'
					)}
				>
					{#if message.role === 'user'}
						{content}
					{:else if content}
						<RichText text={content} blocks />
					{:else if isStreaming && i === tutor.messages.length - 1}
						<span class="inline-flex items-center gap-2" role="status" aria-live="polite">
							<Shimmer as="span" content_length={10}>Thinking…</Shimmer>
							<span class="sr-only">Tutor is thinking</span>
						</span>
					{/if}
				</Message.Content>
			</Message.Root>
		{/each}
	</div>

	<div class={['shrink-0 p-3', embedded && 'relative z-10 overflow-visible pb-5']}>
		<div
			class={[
				'relative flex items-center gap-2 rounded-3xl border border-border bg-background px-3 py-2',
				embedded ? 'origin-bottom shadow-[0_12px_32px_0_rgba(0,0,0,0.02)]' : 'shadow-xs'
			]}
		>
			<textarea
				aria-label="Ask the tutor a question"
				{@attach !embedded && autofocusInput}
				bind:value={inputText}
				onkeydown={handleKeydown}
				oninput={(e) => autoResize(e.currentTarget)}
				rows={1}
				placeholder="Ask a question…"
				disabled={isStreaming}
				class="flex-1 resize-none bg-transparent px-2 text-sm leading-5 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
				style="max-height: 80px; overflow-y: auto;"
			></textarea>
			<button
				onclick={sendMessage}
				disabled={!inputText.trim() || isStreaming}
				class="shrink-0 rounded-lg p-1 text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
				aria-label="Send message"
			>
				<SendHorizontalIcon class="h-4 w-4" />
			</button>
		</div>
	</div>
{/snippet}

{#if embedded}
	<div
		id="landing-ai-tutor-panel"
		class="flex h-full min-h-0 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border bg-card shadow-2xl"
	>
		{@render chatBody()}
	</div>
{:else}
	<div {@attach portalToBody}>
		{#if isOpen}
			<div
				id="ai-tutor-panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="{uid}-title"
				tabindex="-1"
				{@attach trapPanelFocus}
				class="fixed z-60 flex flex-col rounded-2xl border border-border bg-card shadow-2xl outline-none"
				style="
					left: {panelLeft}px;
					top: {panelTop}px;
					width: {panelWidth}px;
					height: {panelHeight}px;
					overflow: hidden;
				"
				transition:fly={{ y: chatAbove ? 16 : -16, duration: 220, easing: quintOut }}
			>
				{@render chatBody()}
			</div>
		{/if}

		<button
			{@attach rememberTrigger}
			id="ai-tutor-trigger"
			type="button"
			aria-expanded={isOpen}
			aria-controls="ai-tutor-panel"
			aria-haspopup="dialog"
			onpointerdown={onBtnPointerDown}
			onpointermove={onBtnPointerMove}
			onpointerup={onBtnPointerUp}
			onpointercancel={onBtnPointerCancel}
			onlostpointercapture={onBtnPointerUp}
			onclick={() => {
				if (hasDragged) {
					hasDragged = false;
					return;
				}
				if (isOpen) {
					handleClose();
				} else {
					handleOpen();
				}
			}}
			class={[
				'fixed z-60 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-shadow select-none hover:shadow-xl'
			]}
			style="left: {btnX}px; top: {btnY}px; cursor: {isDragging ? 'grabbing' : 'grab'};"
			aria-label={isOpen ? 'Close AI Tutor' : 'Open AI Tutor'}
		>
			{#if isOpen}
				<XIcon class="h-5 w-5" />
			{:else}
				<MessageSquareIcon class="h-5 w-5" />
			{/if}
		</button>
		{#if showFirstUseHint}
			<FirstUseHint id="tutor-widget" anchorId="ai-tutor-trigger" side="top" align="end" />
		{/if}
	</div>
{/if}
