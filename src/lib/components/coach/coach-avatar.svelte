<script lang="ts">
	import { onMount } from 'svelte';
	import { watch } from 'runed';
	import { cn } from '$lib/utils.js';
	import {
		COACH_AVATAR_COLOR,
		COACH_AVATAR_SHAPE,
		COACH_EXPRESSION_IDS,
		COACH_AVATAR_STATES,
		type CoachAvatarBlock,
		type CoachAvatarExpression,
		type CoachAvatarState
	} from '$lib/coach/avatar-state';
	import { BotEngine, type BotFrame } from '$lib/coach/bloub/engine';
	import { EXPRESSION_BY_ID } from '$lib/coach/bloub/expressions';
	import { mixHex, SHAPE_BY_ID, type ShapeId } from '$lib/coach/bloub/skins';
	import { DEMI_VIEWBOX, RAYON } from '$lib/coach/bloub/repere';
	import { STATE_BY_ID } from '$lib/coach/bloub/states';
	import { subscribeToAvatarTicker } from '$lib/coach/avatar-ticker';

	type Props = {
		state?: CoachAvatarState;
		expression?: CoachAvatarExpression;
		shape?: ShapeId;
		color?: string;
		size?: number;
		paper?: string;
		paused?: boolean;
		montage?: readonly CoachAvatarBlock[];
		loopMontage?: boolean;
		interactive?: boolean;
		label?: string;
		class?: string;
	};

	let {
		state: requestedState = 'idle',
		expression = 'neutral',
		shape = COACH_AVATAR_SHAPE,
		color = COACH_AVATAR_COLOR,
		size = 96,
		paper = 'var(--background)',
		paused = false,
		montage,
		loopMontage = true,
		interactive = false,
		label = 'Pip, your study coach',
		class: className = ''
	}: Props = $props();

	const uid = $props.id();
	const maskId = `${uid}-mask`;

	const shapeRadii = $derived(
		SHAPE_BY_ID.get(shape)?.radii ?? SHAPE_BY_ID.get(COACH_AVATAR_SHAPE)?.radii ?? null
	);
	const botExpression = $derived(
		EXPRESSION_BY_ID.get(COACH_EXPRESSION_IDS[expression] ?? COACH_EXPRESSION_IDS.neutral) ?? null
	);

	// The engine itself is intentionally not reactive. Only its sampled frame needs
	// to notify Svelte; keeping the engine as a normal class avoids proxying it.
	const engine = new BotEngine(RAYON);
	let frame = $state.raw<BotFrame>(engine.sample(0));
	let mounted = $state(false);
	let visible = $state(true);
	let pageVisible = $state(true);
	let reducedMotion = $state(false);
	let unsubscribeTicker: (() => void) | null = null;
	let lastRenderedMs = 0;

	let sceneClock = 0;
	let lastMontageKey = '';
	let montageIndex = 0;
	let montageElapsed = 0;
	let montageFinished = false;
	let clickActive = false;
	let clickElapsed = 0;
	const clickAnimationDuration = STATE_BY_ID.get(COACH_AVATAR_STATES.progress)?.duration ?? 3.4;

	const montageKey = $derived(
		montage?.map((block) => `${block.state}:${block.duration}`).join('|') ?? ''
	);
	const frameInterval = $derived(size >= 96 ? 1000 / 60 : 1000 / 30);

	function shouldAnimate(): boolean {
		return mounted && !paused && visible && pageVisible && !reducedMotion;
	}

	function sampleFrame(): void {
		frame = engine.sample(sceneClock, { arcSamples: size >= 96 ? 64 : 32 });
	}

	function stopAnimation(): void {
		unsubscribeTicker?.();
		unsubscribeTicker = null;
		lastRenderedMs = 0;
	}

	function startAnimation(): void {
		if (unsubscribeTicker || !shouldAnimate()) return;

		lastRenderedMs = 0;
		unsubscribeTicker = subscribeToAvatarTicker((ms) => {
			if (lastRenderedMs !== 0 && ms - lastRenderedMs < frameInterval) return;

			const dt = lastRenderedMs === 0 ? 0 : Math.min((ms - lastRenderedMs) / 1000, 0.064);
			lastRenderedMs = ms;
			sceneClock += dt;
			advanceClick(dt);
			advanceMontage(dt);
			sampleFrame();
		});
	}

	function observeAvatarVisibility(isPaused: boolean) {
		if (isPaused) {
			visible = true;
			return;
		}
		return (node: SVGSVGElement) => {
			if (typeof IntersectionObserver === 'undefined') return;

			const observer = new IntersectionObserver(
				(entries) => {
					visible = entries[0]?.isIntersecting ?? true;
				},
				{ threshold: 0.01 }
			);
			observer.observe(node);
			return () => observer.disconnect();
		};
	}

	watch(
		() => [mounted, paused, visible, pageVisible, reducedMotion] as const,
		() => {
			if (shouldAnimate()) startAnimation();
			else stopAnimation();
		}
	);

	// Shape and expression changes are deliberately handed to the engine with the
	// current scene time so they morph instead of snapping.
	watch(
		() => [shapeRadii, botExpression] as const,
		([nextShape, nextExpression]) => {
			engine.setShape(nextShape, sceneClock);
			engine.setExpression(nextExpression, sceneClock);
			if (mounted && !shouldAnimate()) sampleFrame();
		}
	);

	// A montage owns playback. Without one, the parent controls the current chat state.
	watch(
		() => montageKey,
		(key) => {
			if (key === lastMontageKey) return;
			lastMontageKey = key;
			montageIndex = 0;
			montageElapsed = 0;
			montageFinished = false;

			const firstBlock = montage?.[0];
			if (!clickActive && firstBlock && firstBlock.state !== engine.state) {
				engine.setState(firstBlock.state, sceneClock);
			}
			if (mounted && !shouldAnimate()) sampleFrame();
		}
	);

	watch(
		() => [requestedState, Boolean(montage?.length)] as const,
		([nextState, hasMontage]) => {
			if (!hasMontage && nextState !== engine.state) {
				engine.setState(nextState, sceneClock);
				if (mounted && !shouldAnimate()) sampleFrame();
			}
		}
	);

	function isHexColor(value: string): boolean {
		return /^#[0-9a-f]{6}$/i.test(value);
	}

	function dotFill(dot: BotFrame['dots'][number]): string {
		if (dot.color) return dot.color;
		if (dot.depth === undefined || !isHexColor(paper) || !isHexColor(color)) return color;
		return mixHex(paper, color, dot.depth);
	}

	function dotTransform(dot: BotFrame['dots'][number]): string {
		if (!dot.d) return '';
		return `translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`;
	}

	function advanceMontage(dt: number): void {
		if (!montage?.length || paused || montageFinished || clickActive) return;

		let remaining = dt;
		let guard = 0;
		while (remaining > 0 && guard < montage.length * 2) {
			const block = montage[montageIndex];
			if (!block) return;

			if (!Number.isFinite(block.duration)) {
				montageElapsed += remaining;
				return;
			}

			const duration = Math.max(0.1, block.duration);
			const blockRemaining = Math.max(0, duration - montageElapsed);
			if (remaining < blockRemaining) {
				montageElapsed += remaining;
				return;
			}

			remaining -= blockRemaining;
			montageElapsed = 0;

			if (montageIndex === montage.length - 1 && !loopMontage) {
				montageFinished = true;
				if (block.state !== 'idle') engine.setState('idle', sceneClock);
				return;
			}

			montageIndex = (montageIndex + 1) % montage.length;
			engine.setState(montage[montageIndex]!.state, sceneClock);
			guard += 1;
		}
	}

	function handleAvatarClick(): void {
		if (!interactive || paused || reducedMotion) return;
		clickActive = true;
		clickElapsed = 0;
		engine.setState(COACH_AVATAR_STATES.progress, sceneClock);
	}

	function advanceClick(dt: number): void {
		if (!clickActive || paused) return;
		clickElapsed += dt;
		if (clickElapsed < clickAnimationDuration) return;

		clickActive = false;
		clickElapsed = 0;
		const returnState = montage?.[montageIndex]?.state ?? requestedState;
		if (returnState !== engine.state) engine.setState(returnState, sceneClock);
	}

	onMount(() => {
		// Apply the initial props before the first browser frame. The references live
		// inside this callback so SSR does not accidentally capture prop snapshots.
		engine.setShape(shapeRadii, sceneClock);
		engine.setExpression(botExpression, sceneClock);
		if (!montage?.length && requestedState !== engine.state) {
			engine.setState(requestedState, sceneClock);
		}
		if (montage?.[0] && montage[0].state !== engine.state) {
			engine.setState(montage[0].state, sceneClock);
		}
		sampleFrame();

		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const handleReducedMotion = (event: MediaQueryListEvent) => {
			reducedMotion = event.matches;
		};
		reducedMotion = mediaQuery.matches;
		mediaQuery.addEventListener('change', handleReducedMotion);

		const handleVisibility = () => {
			pageVisible = document.visibilityState === 'visible';
		};
		document.addEventListener('visibilitychange', handleVisibility);
		handleVisibility();

		mounted = true;
		startAnimation();

		return () => {
			stopAnimation();
			mounted = false;
			mediaQuery.removeEventListener('change', handleReducedMotion);
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});
</script>

{#snippet avatarSvg(svgClass: string)}
	<svg
		{@attach observeAvatarVisibility(paused)}
		width={size}
		height={size}
		viewBox={`${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`}
		role={interactive ? 'presentation' : 'img'}
		aria-label={interactive ? undefined : label}
		aria-hidden={interactive ? 'true' : undefined}
		class={cn('block shrink-0', svgClass)}
	>
		<defs>
			<mask
				id={maskId}
				maskUnits="userSpaceOnUse"
				x={-DEMI_VIEWBOX}
				y={-DEMI_VIEWBOX}
				width={DEMI_VIEWBOX * 2}
				height={DEMI_VIEWBOX * 2}
			>
				<path d={frame.bodyPath} fill="#fff" />
				{#each frame.eyes as eye, index (index)}
					<path d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />
				{/each}
				{#if frame.notch}
					<circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />
				{/if}
			</mask>

			{#each frame.arcs as arc (arc.id)}
				<linearGradient
					id={`${uid}-${arc.id}`}
					gradientUnits="userSpaceOnUse"
					x1={arc.grad.x1}
					y1={arc.grad.y1}
					x2={arc.grad.x2}
					y2={arc.grad.y2}
				>
					{#each arc.grad.stops as stop, index (index)}
						<stop offset={index / (arc.grad.stops.length - 1)} stop-color={stop} />
					{/each}
				</linearGradient>
			{/each}
		</defs>

		<g fill="none" stroke-linecap="round">
			{#each frame.arcs as arc (arc.id)}
				<path
					d={arc.back}
					stroke={`url(#${uid}-${arc.id})`}
					stroke-width={arc.width}
					opacity={arc.opacity}
				/>
			{/each}
		</g>

		{#if frame.dotsBehind}
			<g>
				{#each frame.dots as dot, index (`behind-${index}`)}
					{#if dot.d}
						<path
							d={dot.d}
							transform={dotTransform(dot)}
							fill={dotFill(dot)}
							opacity={dot.opacity}
						/>
					{:else}
						<circle cx={dot.x} cy={dot.y} r={dot.r} fill={dotFill(dot)} opacity={dot.opacity} />
					{/if}
				{/each}
			</g>
		{/if}

		<g opacity={frame.bodyAlpha}>
			<path d={frame.bodyPath} fill={paper} />
			<g mask={`url(#${maskId})`}>
				<rect
					x={-DEMI_VIEWBOX}
					y={-DEMI_VIEWBOX}
					width={DEMI_VIEWBOX * 2}
					height={DEMI_VIEWBOX * 2}
					fill={color}
				/>
			</g>
		</g>

		{#if !frame.dotsBehind}
			<g>
				{#each frame.dots as dot, index (`front-${index}`)}
					{#if dot.d}
						<path
							d={dot.d}
							transform={dotTransform(dot)}
							fill={dotFill(dot)}
							opacity={dot.opacity}
						/>
					{:else}
						<circle cx={dot.x} cy={dot.y} r={dot.r} fill={dotFill(dot)} opacity={dot.opacity} />
					{/if}
				{/each}
			</g>
		{/if}

		{#if frame.notif}
			<circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill="#0ea5e9" />
		{/if}

		<g fill="none" stroke-linecap="round">
			{#each frame.arcs as arc (arc.id)}
				<path
					d={arc.front}
					stroke={`url(#${uid}-${arc.id})`}
					stroke-width={arc.width}
					opacity={arc.opacity}
				/>
			{/each}
		</g>
	</svg>
{/snippet}

{#if interactive}
	<button
		type="button"
		aria-label={label}
		onclick={handleAvatarClick}
		class={cn(
			'inline-flex shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring',
			className
		)}
	>
		{@render avatarSvg('')}
	</button>
{:else}
	{@render avatarSvg(className)}
{/if}
