<script lang="ts">
	import { resolve } from '$app/paths';
	import ThemeToggle from '$lib/components/layout/theme-toggle.svelte';

	let { children } = $props();
</script>

<div class="relative min-h-svh">
	<div class="fixed top-4 right-4 z-50 sm:top-6 sm:right-6 md:right-10">
		<ThemeToggle />
	</div>

	<main
		id="main-content"
		class="bg flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10"
	>
		<div class="flex w-full max-w-sm flex-col gap-6">
			<a href={resolve('/')} class="flex items-center gap-2 self-center font-medium">
				<img src="/logo.png" alt="Free AP Practice" class="size-6 rounded-sm" />
				Free AP Practice
			</a>
			{@render children()}
		</div>
	</main>
</div>
