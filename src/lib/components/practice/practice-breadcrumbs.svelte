<script lang="ts">
	import * as Breadcrumb from '$lib/components/ui/breadcrumb';

	type Crumb = {
		label: string;
		href?: string;
	};

	let { crumbs }: { crumbs: Crumb[] } = $props();
</script>

<Breadcrumb.Root aria-label="Breadcrumb" class="mx-auto max-w-5xl">
	<Breadcrumb.List>
		{#each crumbs as crumb, index (crumb.label)}
			<Breadcrumb.Item>
				{#if crumb.href}
					<Breadcrumb.Link href={crumb.href}>{crumb.label}</Breadcrumb.Link>
				{:else}
					<Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
				{/if}
			</Breadcrumb.Item>

			{#if index < crumbs.length - 1}
				<Breadcrumb.Separator />
			{/if}
		{/each}
	</Breadcrumb.List>
</Breadcrumb.Root>
