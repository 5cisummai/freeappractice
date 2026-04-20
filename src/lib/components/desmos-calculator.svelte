<script lang="ts">
	import { onMount } from 'svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import CalculatorIcon from '@lucide/svelte/icons/calculator';

	type DesmosCalculatorProps = {
		type: 'scientific' | 'graphing';
		onClose: () => void;
	};

	let { type, onClose }: DesmosCalculatorProps = $props();

	const PANEL_WIDTH = $derived(type === 'graphing' ? 420 : 360);
	const PANEL_HEIGHT = $derived(type === 'graphing' ? 520 : 460);
	const VIEWPORT_MARGIN = 12;

	let panelX = $state(0);
	let panelY = $state(0);
	let isDragging = $state(false);
	let dragOffsetX = 0;
	let dragOffsetY = 0;
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	let loadError = $state(false);
	let loadErrorMessage = $state('Could not load the Desmos calculator.');
	let isReady = $state(false);

	function clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

	function clampPosition(x: number, y: number) {
		if (!viewportWidth || !viewportHeight) return { x, y };
		return {
			x: clamp(
				x,
				VIEWPORT_MARGIN,
				Math.max(VIEWPORT_MARGIN, viewportWidth - PANEL_WIDTH - VIEWPORT_MARGIN)
			),
			y: clamp(
				y,
				VIEWPORT_MARGIN,
				Math.max(VIEWPORT_MARGIN, viewportHeight - PANEL_HEIGHT - VIEWPORT_MARGIN)
			)
		};
	}

	function onHandlePointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		isDragging = true;
		dragOffsetX = e.clientX - panelX;
		dragOffsetY = e.clientY - panelY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onHandlePointerMove(e: PointerEvent) {
		if (!isDragging) return;
		const clamped = clampPosition(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
		panelX = clamped.x;
		panelY = clamped.y;
	}

	function onHandlePointerUp() {
		isDragging = false;
	}

	onMount(() => {
		viewportWidth = window.innerWidth;
		viewportHeight = window.innerHeight;

		// Position top-right, clear of sidebar area
		const initial = clampPosition(viewportWidth - PANEL_WIDTH - VIEWPORT_MARGIN, 72);
		panelX = initial.x;
		panelY = initial.y;

		const updateViewport = () => {
			viewportWidth = window.innerWidth;
			viewportHeight = window.innerHeight;
			const clamped = clampPosition(panelX, panelY);
			panelX = clamped.x;
			panelY = clamped.y;
		};
		window.addEventListener('resize', updateViewport);

		// Listen for ready/error messages from the Desmos sandbox iframe
		const onMessage = (e: MessageEvent) => {
			if (e.data?.type === 'ready') {
				isReady = true;
				loadError = false;
			} else if (e.data?.type === 'error') {
				loadError = true;
				loadErrorMessage = e.data.message ?? 'Could not load the Desmos calculator.';
			}
		};
		window.addEventListener('message', onMessage);

		return () => {
			window.removeEventListener('resize', updateViewport);
			window.removeEventListener('message', onMessage);
		};
	});
</script>

<div
	class="fixed z-60 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
	style="left: {panelX}px; top: {panelY}px; width: {PANEL_WIDTH}px; height: {PANEL_HEIGHT}px;"
>
	<!-- Drag handle / title bar -->
	<div
		class="flex cursor-grab items-center justify-between border-b border-border bg-muted/60 px-3 py-2 select-none active:cursor-grabbing"
		role="toolbar"
		tabindex="0"
		aria-label="Calculator drag handle"
		onpointerdown={onHandlePointerDown}
		onpointermove={onHandlePointerMove}
		onpointerup={onHandlePointerUp}
	>
		<div class="flex items-center gap-2 text-sm font-medium text-foreground">
			<CalculatorIcon class="h-3.5 w-3.5 text-muted-foreground" />
			{type === 'graphing' ? 'Graphing Calculator' : 'Scientific Calculator'}
		</div>
		<button
			type="button"
			onclick={onClose}
			onpointerdown={(e) => e.stopPropagation()}
			class="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
			aria-label="Close calculator"
		>
			<XIcon class="h-3.5 w-3.5" />
		</button>
	</div>

	<!-- Calculator container: Desmos runs in an isolated iframe with its own CSP (unsafe-eval scoped there) -->
	<div class="relative min-h-0 flex-1">
		<iframe
			src="/desmos-sandbox?type={type}"
			title="{type === 'graphing' ? 'Graphing' : 'Scientific'} Calculator"
			class="h-full w-full border-0"
			sandbox="allow-scripts allow-same-origin"
			loading="eager"
		></iframe>
		{#if loadError}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card p-6 text-center text-sm text-muted-foreground"
			>
				<p>{loadErrorMessage}</p>
				<p class="text-xs">Check your network connection and try again.</p>
			</div>
		{:else if !isReady}
			<div
				class="absolute inset-0 flex items-center justify-center bg-card text-sm text-muted-foreground"
			>
				Loading calculator...
			</div>
		{/if}
	</div>
</div>
