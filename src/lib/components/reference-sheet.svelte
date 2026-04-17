<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		open = $bindable(false),
		subject
	}: {
		open: boolean;
		subject: string;
	} = $props();

	const referenceSheetUrlBySubject: Record<string, string> = {
		'AP Biology': '/ap-biology-equations-and-formulas-sheet.pdf',
		'AP Chemistry': '/ap-chemistry-equations-sheet.pdf',
		'AP Computer Science A': '/ap-computer-science-a-java-quick-reference.pdf',
		'AP Computer Science Principles': '/ap-computer-science-principles-exam-reference-sheet.pdf',
		'AP Environmental Science': '/ap-environmental-science-exam-reference-sheet.pdf',
		'AP Physics 1': '/ap-physics-1-equations-sheet.pdf',
		'AP Physics 2': '/ap-physics-2-equations-sheet.pdf',
		'AP Physics C: Mechanics': '/ap-physics-c-mechanics-equations-sheet.pdf',
		'AP Physics C: E&M': '/ap-physics-c-electricity-and-magnetism-equations-sheet.pdf',
		'AP Statistics': '/ap-statistics-formula-tables-sheet.pdf'
	};

	const pdfUrl = $derived(referenceSheetUrlBySubject[subject] ?? null);
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-125">
		<Sheet.Header class=" px-6 py-4">
			<div class="flex items-center justify-center gap-16">
				<Sheet.Title class="text-base">Reference Sheet</Sheet.Title>

				{#if pdfUrl}
					<Button onclick={() => window.open(pdfUrl, '_blank')} variant="outline" size="sm">
						View PDF
					</Button>
				{/if}
			</div>
		</Sheet.Header>

		<div class="flex-1 overflow-y-auto px-6 py-5">
			{#if pdfUrl}
				<p class="text-sm text-muted-foreground">
					View the full reference sheet by clicking "View PDF" above.
				</p>
			{:else}
				<p class="text-sm text-muted-foreground">No reference sheet available for this subject.</p>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
