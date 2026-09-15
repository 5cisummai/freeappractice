<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { twAnimateInView } from '$lib/tw-animate';
</script>

<section class="mx-auto w-full max-w-7xl {twAnimateInView}" aria-labelledby="bottom-cta-heading">
	<div class="px-6 py-14 text-center sm:px-10 sm:py-16 lg:px-14 lg:py-20">
		<div class="mx-auto flex max-w-3xl flex-col items-center">
			<h2
				id="bottom-cta-heading"
				class="font-display text-[1.75rem] leading-tight font-medium tracking-tight text-balance text-foreground sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]"
			>
				Join students on the free AP practice platform.
			</h2>

			<div class="mt-8 flex items-center justify-center">
				<Button href={resolve('/signup')} size="lg" variant="default">Sign up free</Button>
			</div>
		</div>
	</div>
</section>
