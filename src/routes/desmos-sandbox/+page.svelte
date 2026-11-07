<script lang="ts">
	import { onMount } from 'svelte';
	import {
		desmosCalculatorScriptUrl,
		desmosSandboxError,
		type DesmosSandboxErrorCode
	} from '#lib/desmos/config.js';

	type CalcType = 'graphing' | 'scientific';

	type DesmosCalculatorInstance = { destroy: () => void };
	type DesmosApi = {
		GraphingCalculator: (el: HTMLDivElement, opts: object) => DesmosCalculatorInstance;
		ScientificCalculator: (el: HTMLDivElement, opts: object) => DesmosCalculatorInstance;
	};
	type DesmosWindow = Window & { Desmos?: DesmosApi };

	let { data } = $props();

	let calcType = $state<CalcType>('graphing');
	let calcContainer: HTMLDivElement | null = null;
	let instance: DesmosCalculatorInstance | null = null;

	function postReady() {
		window.parent.postMessage({ type: 'ready' }, window.location.origin);
	}

	function postError(code: DesmosSandboxErrorCode) {
		window.parent.postMessage(desmosSandboxError(code), window.location.origin);
	}

	function initCalc(type: CalcType) {
		if (!calcContainer) return;
		const D = (window as DesmosWindow).Desmos;
		if (!D) {
			postError('init');
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
		} catch {
			postError('init');
		}
	}

	function setCalcContainer(node: HTMLDivElement) {
		calcContainer = node;
		return () => {
			if (calcContainer === node) calcContainer = null;
		};
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
		const params = new URLSearchParams(window.location.search);
		const typeParam = params.get('type');
		if (typeParam === 'scientific' || typeParam === 'graphing') {
			calcType = typeParam;
		}

		const apiKey = data.apiKey;
		if (!apiKey) {
			postError('missing_api_key');
			return;
		}

		const onMessage = (e: MessageEvent) => {
			if (e.origin !== window.location.origin) return;
			if (
				e.data?.type === 'init' &&
				(e.data.calcType === 'graphing' || e.data.calcType === 'scientific')
			) {
				calcType = e.data.calcType;
				initCalc(calcType);
			}
		};
		window.addEventListener('message', onMessage);

		loadScript(desmosCalculatorScriptUrl(apiKey))
			.then(() => initCalc(calcType))
			.catch(() => postError('script_load'));

		return () => {
			window.removeEventListener('message', onMessage);
			instance?.destroy();
		};
	});
</script>

<svelte:head>
	<title>Desmos Sandbox</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="h-svh w-full overflow-hidden" {@attach setCalcContainer}></div>
