<script lang="ts">
	import { onMount } from 'svelte';
	import CalculatorIcon from '@tabler/icons-svelte/icons/calculator-filled';
	import XIcon from '@tabler/icons-svelte/icons/x-filled';

	type DesmosCalculatorProps = {
		type: 'scientific' | 'graphing';
		onClose: () => void;
	};

	let { type, onClose }: DesmosCalculatorProps = $props();

	const VIEWPORT_MARGIN = 12;
	const MIN_PANEL_WIDTH = 280;
	const MIN_PANEL_HEIGHT = 320;

	let panelWidth = $state(360);
	let panelHeight = $state(460);
	let panelX = $state(0);
	let panelY = $state(0);
	let isDragging = $state(false);
	let isResizing = $state(false);
	let dragOffsetX = 0;
	let dragOffsetY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartW = 0;
	let resizeStartH = 0;
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	let loadError = $state(false);
	let loadErrorMessage = $state('Could not load the Desmos calculator.');
	let isReady = $state(false);

	function clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

	function clampPanelSize(width: number, height: number, x: number, y: number) {
		if (!viewportWidth || !viewportHeight) {
			return {
				width: Math.max(MIN_PANEL_WIDTH, width),
				height: Math.max(MIN_PANEL_HEIGHT, height)
			};
		}
		const maxW = Math.min(viewportWidth - 2 * VIEWPORT_MARGIN, viewportWidth - x - VIEWPORT_MARGIN);
		const maxH = Math.min(
			viewportHeight - 2 * VIEWPORT_MARGIN,
			viewportHeight - y - VIEWPORT_MARGIN
		);
		return {
			width: clamp(width, MIN_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, maxW)),
			height: clamp(height, MIN_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, maxH))
		};
	}

	function clampPosition(x: number, y: number) {
		if (!viewportWidth || !viewportHeight) return { x, y };
		return {
			x: clamp(
				x,
				VIEWPORT_MARGIN,
				Math.max(VIEWPORT_MARGIN, viewportWidth - panelWidth - VIEWPORT_MARGIN)
			),
			y: clamp(
				y,
				VIEWPORT_MARGIN,
				Math.max(VIEWPORT_MARGIN, viewportHeight - panelHeight - VIEWPORT_MARGIN)
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

	function onResizePointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.stopPropagation();
		isResizing = true;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		resizeStartW = panelWidth;
		resizeStartH = panelHeight;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onResizePointerMove(e: PointerEvent) {
		if (!isResizing) return;
		const dw = e.clientX - resizeStartX;
		const dh = e.clientY - resizeStartY;
		const sized = clampPanelSize(resizeStartW + dw, resizeStartH + dh, panelX, panelY);
		panelWidth = sized.width;
		panelHeight = sized.height;
	}

	function onResizePointerUp() {
		isResizing = false;
	}

	onMount(() => {
		panelWidth = type === 'graphing' ? 420 : 360;
		panelHeight = type === 'graphing' ? 520 : 460;

		viewportWidth = window.innerWidth;
		viewportHeight = window.innerHeight;

		const initial = clampPosition(viewportWidth - panelWidth - VIEWPORT_MARGIN, 72);
		panelX = initial.x;
		panelY = initial.y;

		const updateViewport = () => {
			viewportWidth = window.innerWidth;
			viewportHeight = window.innerHeight;
			const sized = clampPanelSize(panelWidth, panelHeight, panelX, panelY);
			panelWidth = sized.width;
			panelHeight = sized.height;
			const clamped = clampPosition(panelX, panelY);
			panelX = clamped.x;
			panelY = clamped.y;
		};
		window.addEventListener('resize', updateViewport);

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
	style="left: {panelX}px; top: {panelY}px; width: {panelWidth}px; height: {panelHeight}px;"
>
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

	<div class="relative min-h-0 flex-1">
		<iframe
			src="/desmos-sandbox?type={type}"
			title="{type === 'graphing' ? 'Graphing' : 'Scientific'} Calculator"
			class="h-full w-full border-0"
			sandbox="allow-scripts allow-same-origin"
			loading="eager"
		></iframe>
		{#if isResizing}
			<div class="absolute inset-0 z-10" aria-hidden="true"></div>
		{/if}
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

	<button
		type="button"
		class="absolute right-0 bottom-0 z-20 flex h-5 w-5 cursor-se-resize touch-none items-end justify-end p-0.5"
		aria-label="Resize calculator"
		onpointerdown={onResizePointerDown}
		onpointermove={onResizePointerMove}
		onpointerup={onResizePointerUp}
		onpointercancel={onResizePointerUp}
	>
		<span
			class="pointer-events-none block h-3 w-3 border-r-2 border-b-2 border-muted-foreground/40"
			aria-hidden="true"
		></span>
	</button>
</div>
