<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import RichText from '$lib/components/rich-text.svelte';
	import subjectToolsData from '$lib/data/subject-tools.json';

	type ReferenceSection = {
		heading: string;
		content: string;
	};

	type ReferenceSheetConfig = {
		title: string;
		sections: ReferenceSection[];
	};

	type SubjectToolEntry = {
		calculator: 'none' | 'scientific' | 'graphing';
		referenceSheet: ReferenceSheetConfig | null;
	};

	let {
		open = $bindable(false),
		subject
	}: {
		open: boolean;
		subject: string;
	} = $props();

	const toolData = subjectToolsData as Record<string, SubjectToolEntry>;
	const sheetConfig = $derived(toolData[subject]?.referenceSheet ?? null);
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-125">
		<Sheet.Header class="border-b border-border px-6 py-4">
			<Sheet.Title class="text-base">{sheetConfig?.title ?? 'Reference Sheet'}</Sheet.Title>
		</Sheet.Header>

		<div class="flex-1 overflow-y-auto px-6 py-5">
			{#if sheetConfig && sheetConfig.sections.length > 0}
				<div class="space-y-6">
					{#each sheetConfig.sections as section (section.heading)}
						<div>
							<h3 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
								{section.heading}
							</h3>
							<div class="text-sm leading-6">
								<RichText text={section.content} />
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">No reference sheet available for this subject.</p>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
