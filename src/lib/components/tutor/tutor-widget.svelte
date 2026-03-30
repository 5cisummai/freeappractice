<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import XIcon from '@lucide/svelte/icons/x';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import RichText from '$lib/components/rich-text.svelte';

	type ChatMessage = {
		role: 'user' | 'assistant';
		content: string;
	};

	type TutorWidgetProps = {
		question: string;
		answer?: string;
		explanation?: string;
		apClass?: string;
		unit?: string;
		answerChoices?: { A: string; B: string; C: string; D: string } | null;
	};

	let {
		question,
		answer = '',
		explanation = '',
		apClass = '',
		unit = '',
		answerChoices = null
	}: TutorWidgetProps = $props();

	let isOpen = $state(false);
	let messages = $state<ChatMessage[]>([]);
	let inputText = $state('');
	let isStreaming = $state(false);
	let hasGreeted = $state(false);
	let scrollContainer = $state<HTMLDivElement | null>(null);
	let inputElement = $state<HTMLTextAreaElement | null>(null);

	// Drag state for the floating button
	let btnX = $state(0);
	let btnY = $state(0);
	let isDragging = $state(false);
	let hasDragged = $state(false);
	let dragOffsetX = 0;
	let dragOffsetY = 0;

	// Position chat panel above button when there's enough space above
	const chatAbove = $derived(btnY > 200);

	async function fetchGreeting() {
		if (hasGreeted || !question) return;
		hasGreeted = true;
		try {
			const res = await fetch('/api/tutor/greeting', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ question })
			});
			const data = (await res.json()) as { message?: string };
			messages.push({
				role: 'assistant',
				content:
					data.message ??
					"Hi! I'm here to help you understand this question. What would you like to know?"
			});
		} catch {
			messages.push({
				role: 'assistant',
				content: "Hi! I'm here to help you understand this question. What would you like to know?"
			});
		}
	}

	function handleOpen() {
		isOpen = true;
		fetchGreeting();
		setTimeout(() => inputElement?.focus(), 200);
	}

	async function sendMessage() {
		const text = inputText.trim();
		if (!text || isStreaming) return;
		inputText = '';

		// Capture history before adding new messages
		const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));
		messages.push({ role: 'user', content: text });
		messages.push({ role: 'assistant', content: '' });
		const assistantIdx = messages.length - 1;

		isStreaming = true;

		try {
			const res = await fetch('/api/tutor/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					question,
					answer,
					explanation,
					apClass,
					unit,
					answerChoices,
					conversationHistory,
					message: text
				})
			});

			if (!res.ok || !res.body) throw new Error('Stream failed');

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) {
					if (!line.startsWith('data: ')) continue;
					const data = line.slice(6).trim();
					if (data === '[DONE]') continue;
					try {
						const parsed = JSON.parse(data) as { content?: string };
						if (parsed.content) {
							messages[assistantIdx].content += parsed.content;
						}
					} catch {
						// ignore parse errors on individual chunks
					}
				}
			}
		} catch {
			messages[assistantIdx].content = 'Sorry, something went wrong. Please try again.';
		} finally {
			isStreaming = false;
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
		dragOffsetX = e.clientX - btnX;
		dragOffsetY = e.clientY - btnY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onBtnPointerMove(e: PointerEvent) {
		if (!isDragging) return;
		hasDragged = true;
		const BTN = 48;
		btnX = Math.max(0, Math.min(window.innerWidth - BTN, e.clientX - dragOffsetX));
		btnY = Math.max(0, Math.min(window.innerHeight - BTN, e.clientY - dragOffsetY));
	}

	function onBtnPointerUp() {
		isDragging = false;
	}

	onMount(() => {
		btnX = window.innerWidth - 64;
		btnY = window.innerHeight - 64;
	});

	// Auto-scroll to bottom when messages update
	$effect(() => {
		// Track message count and last message content for streaming scroll
		void messages.length;
		const last = messages[messages.length - 1];
		void last?.content;
		if (scrollContainer) {
			requestAnimationFrame(() => {
				if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
			});
		}
	});

	// Reset state when question changes
	$effect(() => {
		void question;
		messages = [];
		hasGreeted = false;
		if (isOpen && question) {
			setTimeout(fetchGreeting, 50);
		}
	});
</script>

<!-- Anchor div: fixed at the button's dragged position -->
<div class="fixed z-50" style="left: {btnX}px; top: {btnY}px;">
	<!-- Chat panel: absolute, opens above or below the button -->
	{#if isOpen}
		<div
			class="absolute flex flex-col rounded-2xl border border-border bg-card shadow-2xl"
			style="
				right: 0;
				{chatAbove ? 'bottom: 56px;' : 'top: 56px;'}
				width: 340px;
				height: 480px;
				overflow: hidden;
			"
			transition:fly={{ y: chatAbove ? 16 : -16, duration: 220, easing: quintOut }}
		>
			<!-- Header -->
			<div
				class="flex shrink-0 items-center justify-between border-b border-border bg-primary px-4 py-3"
			>
				<div class="flex items-center gap-2">
					<SparklesIcon class="h-4 w-4 text-primary-foreground" />
					<span class="text-sm font-semibold text-primary-foreground">AI Tutor</span>
				</div>
				<button
					onclick={() => (isOpen = false)}
					class="rounded-md p-0.5 text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
					aria-label="Close AI Tutor"
				>
					<XIcon class="h-4 w-4" />
				</button>
			</div>

			<!-- Messages -->
			<div
				bind:this={scrollContainer}
				class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
			>
				{#if messages.length === 0}
					<div class="flex items-center justify-center py-6 text-sm text-muted-foreground">
						<span>Loading...</span>
					</div>
				{/if}
				{#each messages as message, i (i)}
					<div class={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
						{#if message.role === 'user'}
							<div
								class="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
							>
								{message.content}
							</div>
						{:else}
							<div class="max-w-[90%] text-sm text-foreground/90">
								{#if message.content}
									<RichText text={message.content} />
								{:else if isStreaming && i === messages.length - 1}
									<span class="inline-flex gap-1 text-muted-foreground">
										<span class="animate-bounce" style="animation-delay: 0ms">·</span>
										<span class="animate-bounce" style="animation-delay: 100ms">·</span>
										<span class="animate-bounce" style="animation-delay: 200ms">·</span>
									</span>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Input -->
			<div class="shrink-0 border-t border-border p-3">
				<div class="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2">
					<textarea
						bind:this={inputElement}
						bind:value={inputText}
						onkeydown={handleKeydown}
						oninput={(e) => autoResize(e.currentTarget)}
						rows={1}
						placeholder="Ask a question…"
						disabled={isStreaming}
						class="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
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
		</div>
	{/if}

	<!-- Floating toggle button -->
	<button
		onpointerdown={onBtnPointerDown}
		onpointermove={onBtnPointerMove}
		onpointerup={onBtnPointerUp}
		onclick={() => {
			if (hasDragged) {
				hasDragged = false;
				return;
			}
			if (isOpen) {
				isOpen = false;
			} else {
				handleOpen();
			}
		}}
		class="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-shadow select-none hover:shadow-xl"
		style="cursor: {isDragging ? 'grabbing' : 'grab'};"
		aria-label={isOpen ? 'Close AI Tutor' : 'Open AI Tutor'}
	>
		{#if isOpen}
			<XIcon class="h-5 w-5" />
		{:else}
			<MessageSquareIcon class="h-5 w-5" />
		{/if}
	</button>
</div>
