<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import XIcon from '@lucide/svelte/icons/x';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import SquareIcon from '@lucide/svelte/icons/square';
	import SearchIcon from '@lucide/svelte/icons/search';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import RichText from '$lib/components/content/rich-text.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { diagramDataUrl, getDiagramOutput } from '$lib/super/diagram-ui';
	import type { SuperAgentUIMessage } from '$lib/super/coach.server';
	import { toast } from 'svelte-sonner';

	type Props = {
		apClass?: string;
		unit?: string;
		questionId?: string;
		frqQuestionId?: string;
		frqAttemptId?: string;
		topic?: string;
		showFirstUseHint?: boolean;
	};

	let {
		apClass = '',
		unit = '',
		questionId = '',
		frqQuestionId = '',
		frqAttemptId = '',
		topic = '',
		showFirstUseHint = false
	}: Props = $props();

	let isOpen = $state(false);
	let inputText = $state('');
	let sessionId = $state('');
	let conversationId = $state('');
	let lastUsageWarning = $state<number | null>(null);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let triggerEl: HTMLButtonElement | null = $state(null);
	let btnX = $state(0);
	let btnY = $state(0);
	let isDragging = $state(false);
	let hasDragged = $state(false);
	let dragOffsetX = 0;
	let dragOffsetY = 0;

	const BUTTON_SIZE = 48;
	const PANEL_WIDTH = 360;
	const PANEL_HEIGHT = 500;
	const VIEWPORT_MARGIN = 12;
	const PANEL_GAP = 8;

	const isFrq = $derived(Boolean(frqQuestionId));
	const contextLabel = $derived(isFrq ? 'FRQ' : topic || unit || apClass || 'question');
	const panelWidth = $derived(
		viewportWidth
			? Math.min(PANEL_WIDTH, Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2))
			: PANEL_WIDTH
	);
	const panelHeight = $derived(
		viewportHeight
			? Math.min(PANEL_HEIGHT, Math.max(0, viewportHeight - VIEWPORT_MARGIN * 2))
			: PANEL_HEIGHT
	);
	const panelLeft = $derived(
		viewportWidth
			? Math.min(
					Math.max(VIEWPORT_MARGIN, btnX + BUTTON_SIZE - panelWidth),
					viewportWidth - panelWidth - VIEWPORT_MARGIN
				)
			: VIEWPORT_MARGIN
	);
	const chatAbove = $derived(
		!viewportHeight || btnY - PANEL_GAP >= viewportHeight - (btnY + BUTTON_SIZE + PANEL_GAP)
	);
	const panelTop = $derived(
		viewportHeight
			? Math.min(
					Math.max(
						VIEWPORT_MARGIN,
						chatAbove ? btnY - PANEL_GAP - panelHeight : btnY + BUTTON_SIZE + PANEL_GAP
					),
					viewportHeight - panelHeight - VIEWPORT_MARGIN
				)
			: VIEWPORT_MARGIN
	);

	const chat = new Chat<SuperAgentUIMessage>({
		messages: [],
		transport: new DefaultChatTransport<SuperAgentUIMessage>({
			api: '/api/tutor/chat',
			fetch: async (url, init) => {
				const response = await apiFetch(String(url), init);
				const responseConversationId = response.headers.get('X-Super-Conversation-Id');
				if (responseConversationId) {
					conversationId = responseConversationId;
					sessionStorage.setItem(conversationStorageKey(), responseConversationId);
				}
				showUsageWarning(response);
				return response;
			},
			prepareSendMessagesRequest: ({ messages }) => ({
				api: isFrq ? '/api/tutor/frq' : '/api/tutor/chat',
				body: {
					sessionId,
					context: {
						mode: 'question',
						page: 'practice',
						questionId: isFrq ? frqQuestionId : questionId,
						questionType: isFrq ? 'frq' : 'mcq',
						...(frqAttemptId ? { frqAttemptId } : {})
					},
					...(conversationId ? { conversationId } : {}),
					messages: messages.slice(-12)
				}
			})
		})
	});

	const streaming = $derived(chat.status === 'submitted' || chat.status === 'streaming');
	const scrollTrigger = $derived.by(() => {
		const last = chat.messages.at(-1);
		return `${chat.messages.length}:${last?.parts.length ?? 0}:${messageText(last).length}`;
	});

	type ToolPart = {
		type: string;
		state?: string;
		output?: unknown;
		errorText?: string;
	};

	type ApprovalProposal = {
		category: 'goals' | 'study_plans';
		proposed: unknown;
	};

	function messageText(message: SuperAgentUIMessage | undefined): string {
		return (message?.parts ?? [])
			.filter((part) => part.type === 'text')
			.map((part) => part.text)
			.join('\n');
	}

	function toolParts(message: SuperAgentUIMessage): ToolPart[] {
		return message.parts.filter((part) => {
			const candidate = part as unknown as { type?: unknown };
			return typeof candidate.type === 'string' && candidate.type.startsWith('tool-');
		}) as unknown as ToolPart[];
	}

	function toolLabel(part: ToolPart): string {
		const name = part.type
			.replace(/^tool-/, '')
			.replaceAll('_', ' ')
			.replace(/^./, (letter) => letter.toUpperCase());
		if (part.errorText || part.state === 'output-error')
			return `Could not finish ${name.toLowerCase()}`;
		if (part.state === 'input-streaming' || part.state === 'input-available') {
			return `Working on ${name.toLowerCase()}…`;
		}
		return `Finished ${name.toLowerCase()}`;
	}

	function asRecord(value: unknown): Record<string, unknown> {
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	}

	function getApprovalProposal(part: ToolPart): ApprovalProposal | null {
		const output = asRecord(part.output);
		if (
			output.approvalRequired !== true ||
			(output.category !== 'goals' && output.category !== 'study_plans')
		) {
			return null;
		}
		return { category: output.category, proposed: output.proposed };
	}

	function proposalLabel(proposal: ApprovalProposal): string {
		if (proposal.category === 'goals') return 'Approve goal changes';
		const proposed = asRecord(proposal.proposed);
		const tasks = Array.isArray(proposed.tasks) ? proposed.tasks.length : 0;
		return tasks
			? `Approve ${tasks} study-plan task${tasks === 1 ? '' : 's'}`
			: 'Approve study-plan changes';
	}

	async function approve(proposal: ApprovalProposal): Promise<void> {
		try {
			const response = await apiFetch('/api/coach/approval', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId, categories: [proposal.category] })
			});
			const payload = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(payload, 'Could not approve this change.'));
			toast.success('The Super Agent can make that change for the next 30 minutes.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not approve this change.');
		}
	}

	function showUsageWarning(response: Response): void {
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

	function conversationStorageKey(): string {
		return `super-question-conversation:${isFrq ? 'frq' : 'mcq'}:${isFrq ? frqQuestionId : questionId}:${frqAttemptId || 'none'}`;
	}

	async function loadConversation(id: string): Promise<void> {
		try {
			const response = await apiFetch(`/api/super/conversations/${id}`);
			const payload = await readJsonOrNull<{
				messages?: Array<{
					id: string;
					role: 'user' | 'assistant';
					parts: SuperAgentUIMessage['parts'];
				}>;
			}>(response);
			if (!response.ok || !payload?.messages) {
				conversationId = '';
				sessionStorage.removeItem(conversationStorageKey());
				return;
			}
			chat.messages = payload.messages as SuperAgentUIMessage[];
		} catch {
			conversationId = '';
			sessionStorage.removeItem(conversationStorageKey());
		}
	}

	function autoScroll(trigger: string) {
		void trigger;
		return (node: HTMLDivElement) => {
			const frame = requestAnimationFrame(() => (node.scrollTop = node.scrollHeight));
			return () => cancelAnimationFrame(frame);
		};
	}

	function trapFocus(node: HTMLElement): () => void {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Tab') return;
			const focusable = Array.from(
				node.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled])')
			);
			if (!focusable.length) return;
			const first = focusable[0];
			const last = focusable.at(-1)!;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		node.addEventListener('keydown', onKeyDown);
		return () => node.removeEventListener('keydown', onKeyDown);
	}

	function updateViewport(): void {
		viewportWidth = window.innerWidth;
		viewportHeight = window.innerHeight;
		if (!btnX && !btnY) {
			btnX = Math.max(VIEWPORT_MARGIN, viewportWidth - BUTTON_SIZE - 28);
			btnY = Math.max(VIEWPORT_MARGIN, viewportHeight - BUTTON_SIZE - 28);
		}
	}

	function clampButton(x: number, y: number): { x: number; y: number } {
		return {
			x: Math.min(
				Math.max(VIEWPORT_MARGIN, x),
				Math.max(VIEWPORT_MARGIN, viewportWidth - BUTTON_SIZE - VIEWPORT_MARGIN)
			),
			y: Math.min(
				Math.max(VIEWPORT_MARGIN, y),
				Math.max(VIEWPORT_MARGIN, viewportHeight - BUTTON_SIZE - VIEWPORT_MARGIN)
			)
		};
	}

	function onPointerDown(event: PointerEvent): void {
		const target = event.currentTarget as HTMLElement;
		isDragging = true;
		hasDragged = false;
		dragOffsetX = event.clientX - target.getBoundingClientRect().left;
		dragOffsetY = event.clientY - target.getBoundingClientRect().top;
		target.setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent): void {
		if (!isDragging) return;
		const position = clampButton(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
		if (Math.abs(position.x - btnX) > 3 || Math.abs(position.y - btnY) > 3) hasDragged = true;
		btnX = position.x;
		btnY = position.y;
	}

	function onPointerUp(event: PointerEvent): void {
		isDragging = false;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
	}

	function open(): void {
		isOpen = true;
		void tick().then(() => {
			(
				document.querySelector('#super-tutor-panel textarea') as HTMLTextAreaElement | null
			)?.focus();
		});
	}

	function close(): void {
		isOpen = false;
		chat.stop();
		requestAnimationFrame(() => triggerEl?.focus());
	}

	async function send(): Promise<void> {
		const text = inputText.trim();
		if (!text || streaming || !sessionId) return;
		inputText = '';
		try {
			await chat.sendMessage({ text });
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'The Super Agent is unavailable right now.'
			);
		}
	}

	onMount(() => {
		sessionId = crypto.randomUUID();
		conversationId = sessionStorage.getItem(conversationStorageKey()) ?? '';
		if (conversationId) void loadConversation(conversationId);
		updateViewport();
		window.addEventListener('resize', updateViewport);
		return () => window.removeEventListener('resize', updateViewport);
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (isOpen && event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	}}
/>

<div class="pointer-events-none fixed inset-0 z-60">
	{#if isOpen}
		<div
			id="super-tutor-panel"
			role="dialog"
			aria-modal="true"
			aria-label="Super Tutor"
			{@attach trapFocus}
			class="pointer-events-auto fixed flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none"
			style="left: {panelLeft}px; top: {panelTop}px; width: {panelWidth}px; height: {panelHeight}px;"
		>
			<div class="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
				<div class="flex items-center gap-2">
					<Badge
						variant="outline"
						class="gap-1 border-violet-300/50 super-tier-gradient px-2 py-0.5 text-[0.65rem]"
					>
						Super
					</Badge>
					<SparklesIcon class="h-4 w-4" />
					<span class="text-sm font-semibold">Tutor</span>
				</div>
				<button
					type="button"
					onclick={close}
					class="rounded-md p-0.5 hover:bg-muted"
					aria-label="Close Super Tutor"
				>
					<XIcon class="h-4 w-4" />
				</button>
			</div>

			<div
				{@attach autoScroll(scrollTrigger)}
				class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
			>
				{#if chat.messages.length === 0}
					<div
						class="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground"
					>
						<p>
							I already have this {contextLabel} and your relevant practice history. Ask for help.
						</p>
					</div>
				{/if}
				{#each chat.messages as message (message.id)}
					<div class={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
						{#if message.role === 'user'}
							<div
								class="ph-mask-pii max-w-[88%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
							>
								{messageText(message)}
							</div>
						{:else}
							<div class="ph-mask-pii max-w-[94%] space-y-2 text-sm text-foreground/90">
								{#if messageText(message)}
									<RichText text={messageText(message)} blocks />
								{/if}
								{#each toolParts(message) as part, index (`${part.type}-${index}`)}
									{@const diagram = getDiagramOutput(part.output)}
									{#if diagram}
										<figure class="overflow-hidden rounded-xl border border-border/70 bg-white p-2">
											<img
												src={diagramDataUrl(diagram.svg)}
												alt={diagram.accessibleDescription}
												width={diagram.width}
												height={diagram.height}
												class="h-auto max-h-64 w-full object-contain"
											/>
											{#if diagram.title}
												<figcaption class="px-1 pt-1 text-xs text-muted-foreground">
													{diagram.title}
												</figcaption>
											{/if}
										</figure>
									{/if}
									<div
										class="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1 text-xs text-muted-foreground"
									>
										{#if part.type.startsWith('tool-update_')}
											<PencilIcon class="size-3.5" />
										{:else}
											<SearchIcon class="size-3.5" />
										{/if}
										<span>{toolLabel(part)}</span>
									</div>
									{@const proposal = getApprovalProposal(part)}
									{#if proposal}
										<button
											type="button"
											class="rounded-lg border border-violet-300/50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/30"
											onclick={() => void approve(proposal)}
										>
											{proposalLabel(proposal)}
										</button>
									{/if}
								{/each}
								{#if !messageText(message) && streaming && message === chat.messages.at(-1)}
									<span class="inline-flex gap-1 text-muted-foreground"
										><span>·</span><span>·</span><span>·</span></span
									>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<div class="shrink-0 border-t border-border/70 p-3">
				<div
					class="flex items-end gap-2 rounded-3xl border border-border bg-background px-3 py-2 shadow-sm"
				>
					<textarea
						bind:value={inputText}
						onkeydown={(event) => {
							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault();
								void send();
							}
						}}
						rows={1}
						placeholder="Ask for help…"
						disabled={streaming}
						class="min-h-9 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:opacity-50"
					></textarea>
					<button
						type="button"
						onclick={() => (streaming ? chat.stop() : void send())}
						disabled={!streaming && !inputText.trim()}
						class="shrink-0 rounded-lg p-1 text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
						aria-label={streaming ? 'Stop response' : 'Send message'}
					>
						{#if streaming}<SquareIcon class="h-4 w-4" />{:else}<SendHorizontalIcon
								class="h-4 w-4"
							/>{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<button
		bind:this={triggerEl}
		type="button"
		class="super-tier-gradient-fab pointer-events-auto fixed z-60 flex h-12 w-12 items-center justify-center rounded-full select-none"
		style="left: {btnX}px; top: {btnY}px; cursor: {isDragging ? 'grabbing' : 'grab'};"
		aria-expanded={isOpen}
		aria-controls="super-tutor-panel"
		aria-haspopup="dialog"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onclick={() => {
			if (hasDragged) {
				hasDragged = false;
				return;
			}
			if (isOpen) close();
			else open();
		}}
		aria-label={isOpen ? 'Close Super Tutor' : 'Open Super Tutor'}
	>
		{#if isOpen}<XIcon class="h-5 w-5" />{:else}<MessageSquareIcon class="h-5 w-5" />{/if}
	</button>
	{#if showFirstUseHint}
		<div
			class="pointer-events-none fixed right-20 bottom-6 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg"
		>
			Ask Super Tutor about this question.
		</div>
	{/if}
</div>
