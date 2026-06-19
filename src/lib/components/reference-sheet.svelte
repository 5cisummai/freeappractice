<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import RichText from '$lib/components/rich-text.svelte';

	type ReferenceSheetData = {
		title: string;
		sections: { heading: string; content: string }[];
	};

	let {
		open = $bindable(false),
		referenceSheet
	}: {
		open: boolean;
		referenceSheet: ReferenceSheetData | null;
	} = $props();
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-125">
		<Sheet.Header class="px-6 py-4">
			<Sheet.Title class="text-base">
				{referenceSheet?.title ?? 'Reference Sheet'}
			</Sheet.Title>
		</Sheet.Header>

		<div class="flex-1 overflow-y-auto px-6 py-5">
			{#if referenceSheet && referenceSheet.sections.length > 0}
				<div class="space-y-6">
					{#each referenceSheet.sections as section (section.heading)}
						{#if section.content.trim()}
							<section>
								<h3 class="mb-2 text-sm font-semibold">{section.heading}</h3>
								<RichText text={section.content} class="text-sm text-muted-foreground" />
							</section>
						{/if}
					{/each}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">No reference sheet available for this subject.</p>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
