<script lang="ts">
	import { PUBLIC_DESMOS_API_KEY } from '$env/static/public';
	import { onMount } from 'svelte';

	type CalcType = 'graphing' | 'scientific';

	type DesmosCalculatorInstance = { destroy: () => void };
	type DesmosApi = {
		GraphingCalculator: (el: HTMLDivElement, opts: object) => DesmosCalculatorInstance;
		ScientificCalculator: (el: HTMLDivElement, opts: object) => DesmosCalculatorInstance;
	};
	type DesmosWindow = Window & { Desmos?: DesmosApi };

	let calcType = $state<CalcType>('graphing');
	let calcContainer: HTMLDivElement | null = null;
	let instance: DesmosCalculatorInstance | null = null;

	function postReady() {
		window.parent.postMessage({ type: 'ready' }, '*');
	}

	function postError(message: string) {
		window.parent.postMessage({ type: 'error', message }, '*');
	}

	function initCalc(type: CalcType) {
		if (!calcContainer) return;
		const D = (window as DesmosWindow).Desmos;
		if (!D) {
			postError('Desmos API not available');
			return;
		}
		instance?.destroy();
		try {
			if (type === 'graphing') {
				instance = D.GraphingCalculator(calcContainer, {
					keypad: true,
					keypadActivated: true,
					expressions: true,
					settingsMenu: false
				});
			} else {
				instance = D.ScientificCalculator(calcContainer, {
					keypad: true,
					settingsMenu: false
				});
			}
			postReady();
		} catch (err) {
			postError(err instanceof Error ? err.message : 'Failed to initialize Desmos');
		}
	}

	function loadScript(src: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const existing = document.getElementById('desmos-script');
			if (existing) {
				if ((window as DesmosWindow).Desmos) {
					resolve();
				} else {
					existing.addEventListener('load', () => resolve(), { once: true });
					existing.addEventListener('error', () => reject(new Error('Script load failed')), {
						once: true
					});
				}
				return;
			}
			const script = document.createElement('script');
			script.id = 'desmos-script';
			script.src = src;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Script load failed'));
			document.head.appendChild(script);
		});
	}

	onMount(() => {
		// Read the calculator type from the URL search param
		const params = new URLSearchParams(window.location.search);
		const typeParam = params.get('type');
		if (typeParam === 'scientific' || typeParam === 'graphing') {
			calcType = typeParam;
		}

		const apiKey = PUBLIC_DESMOS_API_KEY?.trim();
		if (!apiKey) {
			postError('Missing PUBLIC_DESMOS_API_KEY — add it to your .env file');
			return;
		}

		const src = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;

		// Listen for re-init messages from parent (e.g. type switch)
		const onMessage = (e: MessageEvent) => {
			if (e.data?.type === 'init' && (e.data.calcType === 'graphing' || e.data.calcType === 'scientific')) {
				calcType = e.data.calcType;
				initCalc(calcType);
			}
		};
		window.addEventListener('message', onMessage);

		loadScript(src)
			.then(() => initCalc(calcType))
			.catch((err) => postError(err instanceof Error ? err.message : 'Failed to load Desmos'));

		return () => {
			window.removeEventListener('message', onMessage);
			instance?.destroy();
		};
	});
</script>

<svelte:head>
	<title>Desmos Sandbox</title>
	<!-- Prevent this page from being indexed -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div bind:this={calcContainer} class="calc-container"></div>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.calc-container {
		width: 100%;
		height: 100vh;
	}
</style>
