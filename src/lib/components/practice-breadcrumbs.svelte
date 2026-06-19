<script lang="ts">
	type Crumb = {
		label: string;
		href?: string;
	};

	let { crumbs }: { crumbs: Crumb[] } = $props();
</script>

<nav aria-label="Breadcrumb" class="mx-auto max-w-5xl text-sm text-muted-foreground">
	<ol class="flex flex-wrap items-center gap-1.5">
		{#each crumbs as crumb, index (crumb.label)}
			{#if index > 0}
				<li aria-hidden="true" class="text-border">/</li>
			{/if}
			<li>
				{#if crumb.href}
					<a href={crumb.href} class="transition-colors hover:text-foreground">
						{crumb.label}
					</a>
				{:else}
					<span class="text-foreground" aria-current="page">{crumb.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
