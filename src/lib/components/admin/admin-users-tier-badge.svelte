<script lang="ts">
	let { plan }: { plan: 'free' | 'super' } = $props();
</script>

{#if plan === 'super'}
	<span
		class="inline-flex items-center rounded-full border border-violet-300/50 super-tier-gradient px-2.5 py-0.5 text-xs font-semibold text-violet-700 shadow-sm shadow-violet-500/10 dark:text-violet-300"
		>Super</span
	>
{/if}
