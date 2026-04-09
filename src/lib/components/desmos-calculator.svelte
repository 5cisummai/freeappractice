<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { PUBLIC_DESMOS_API_KEY } from '$env/static/public';
	import XIcon from '@lucide/svelte/icons/x';
	import CalculatorIcon from '@lucide/svelte/icons/calculator';

	type DesmosCalculatorInstance = {
		destroy: () => void;
	};

	type DesmosApi = {
		GraphingCalculator: (
			element: HTMLDivElement,
			options: {
				keypad: boolean;
				keypadActivated?: boolean;
				expressions?: boolean;
				settingsMenu: boolean;
			}
		) => DesmosCalculatorInstance;
		ScientificCalculator: (
			element: HTMLDivElement,
			options: {
				keypad: boolean;
				settingsMenu: boolean;
			}
		) => DesmosCalculatorInstance;
	};

	type DesmosWindow = Window & {
		Desmos?: DesmosApi;
	};

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

	let calculatorContainer: HTMLDivElement | null = null;
	let calculatorInstance: DesmosCalculatorInstance | null = null;
	let loadError = $state(false);
	let loadErrorMessage = $state('Could not load the Desmos calculator.');
	let isReady = $state(false);
	let destroyed = false;

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

	function captureCalculatorContainer(node: HTMLDivElement) {
		calculatorContainer = node;

		return {
			destroy() {
				if (calculatorContainer === node) {
					calculatorContainer = null;
				}
			}
		};
	}

	function loadDesmosScript(apiKey: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const desmosWindow = window as DesmosWindow;
			if (desmosWindow.Desmos) {
				resolve();
				return;
			}
			const existing = document.getElementById('desmos-api-script');
			if (existing instanceof HTMLScriptElement) {
				if (existing.dataset.loaded === 'true') {
					resolve();
					return;
				}
				existing.addEventListener('load', () => resolve(), { once: true });
				existing.addEventListener('error', () => reject(new Error('Desmos failed to load')), {
					once: true
				});
				return;
			}
			const script = document.createElement('script');
			script.id = 'desmos-api-script';
			script.src = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
			script.onload = () => {
				script.dataset.loaded = 'true';
				resolve();
			};
			script.onerror = () => reject(new Error('Desmos failed to load'));
			document.head.appendChild(script);
		});
	}

	function initCalculator() {
		if (destroyed || !calculatorContainer) return;
		const D = (window as DesmosWindow).Desmos;
		if (!D) return;
		try {
			if (type === 'graphing') {
				calculatorInstance = D.GraphingCalculator(calculatorContainer, {
					keypad: true,
					keypadActivated: true,
					expressions: true,
					settingsMenu: false
				});
			} else {
				calculatorInstance = D.ScientificCalculator(calculatorContainer, {
					keypad: true,
					settingsMenu: false
				});
			}
			isReady = true;
			loadError = false;
		} catch (error) {
			loadError = true;
			loadErrorMessage =
				error instanceof Error && error.message
					? error.message
					: 'Could not load the Desmos calculator.';
		}
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
		const removeResize = () => window.removeEventListener('resize', updateViewport);

		const apiKey = PUBLIC_DESMOS_API_KEY?.trim();
		if (!apiKey) {
			loadError = true;
			loadErrorMessage =
				'Add PUBLIC_DESMOS_API_KEY to your .env file. Get a key at https://www.desmos.com/my-api';
			return removeResize;
		}

		loadDesmosScript(apiKey)
			.then(() => initCalculator())
			.catch((error) => {
				if (!destroyed) {
					loadError = true;
					loadErrorMessage =
						error instanceof Error && error.message
							? error.message
							: 'Could not load the Desmos calculator.';
				}
			});

		return removeResize;
	});

	onDestroy(() => {
		destroyed = true;
		calculatorInstance?.destroy();
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

	<!-- Calculator container -->
	<div class="relative min-h-0 flex-1">
		<!-- Always in DOM and visible so Desmos initialises in a properly laid-out element -->
		<div use:captureCalculatorContainer class="h-full w-full"></div>
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
