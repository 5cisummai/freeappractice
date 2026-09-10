<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	let {
		load,
		pending,
		error,
		children
	}: {
		load: () => Promise<T>;
		pending: string;
		error: string;
		children: Snippet<[T]>;
	} = $props();

	let attempt = $state(0);
</script>

{#key attempt}
	{#await load()}
		<p class="py-8 text-center text-sm text-muted-foreground">{pending}</p>
	{:then loaded}
		{@render children(loaded)}
	{:catch}
		<p class="py-8 text-center text-sm text-destructive">
			{error}
			<button
				type="button"
				class="ml-1 font-medium underline underline-offset-4"
				onclick={() => (attempt += 1)}>Retry</button
			>
		</p>
	{/await}
{/key}
