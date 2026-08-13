<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { SUPER_GRADIENT_BUTTON_CLASS } from '$lib/super/ui';
	import type { Snippet } from 'svelte';
	import { twAnimateInView } from '$lib/tw-animate';

	type HeadingLevel = 'h1' | 'h2';

	let {
		id,
		headingLevel = 'h2',
		titleClass = 'font-display text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl',
		descriptionClass = 'text-base leading-7 text-muted-foreground sm:text-lg',
		class: className = '',
		showSignup = true,
		superSignup = false,
		signupHref = resolve('/signup'),
		eyebrow,
		title,
		description,
		actions
	}: {
		id: string;
		headingLevel?: HeadingLevel;
		titleClass?: string;
		descriptionClass?: string;
		class?: string;
		showSignup?: boolean;
		superSignup?: boolean;
		signupHref?: string;
		eyebrow?: Snippet;
		title: Snippet;
		description?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<div class="space-y-3 {twAnimateInView} {className}">
	{#if eyebrow}
		<div>{@render eyebrow()}</div>
	{/if}

	<div
		class="grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start lg:justify-between"
	>
		<div class="space-y-4">
			<svelte:element this={headingLevel} {id} class="{titleClass} text-left">
				{@render title()}
			</svelte:element>

			{#if showSignup}
				<Button
					href={signupHref}
					size="lg"
					variant={superSignup ? 'default' : 'outline'}
					class={superSignup ? `rounded-full px-6 ${SUPER_GRADIENT_BUTTON_CLASS}` : undefined}
				>
					Sign up free
				</Button>
			{/if}
		</div>

		{#if description || actions}
			<div class="space-y-4 lg:justify-self-end">
				{#if description}
					<div class="{descriptionClass} text-left">
						{@render description()}
					</div>
				{/if}
				{#if actions}
					{@render actions()}
				{/if}
			</div>
		{/if}
	</div>
</div>
