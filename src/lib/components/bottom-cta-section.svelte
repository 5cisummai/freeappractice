<script lang="ts">
	import { resolve } from '$app/paths';
	import { twAnimateInView } from '$lib/tw-animate';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
</script>

<section
	class="mx-auto w-full max-w-xl text-center {twAnimateInView}"
	aria-labelledby="bottom-cta-heading"
>
	<h2 id="bottom-cta-heading" class="font-display text-2xl font-medium tracking-tight sm:text-3xl">
		Ready to practice?
	</h2>
	<p class="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
		Pick a subject and generate your first question in seconds.
	</p>
	<div class="mt-5 flex flex-wrap items-center justify-center gap-3">
		<Button href={resolve('/subjects')} size="lg" class="rounded-full px-6">
			Browse Subjects
			<ArrowRightIcon class="size-4" />
		</Button>
		<Button href={resolve('/signup')} variant="outline" size="lg" class="rounded-full px-6">
			Create Free Account
		</Button>
	</div>
</section>
