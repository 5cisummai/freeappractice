<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import RichText from '$lib/components/rich-text.svelte';
	import subjectToolsData from '$lib/data/subject-tools.json';

	import apBiologyPdf from '../../content/references/ap-biology-equations-and-formulas-sheet.pdf?url';
	import apChemistryPdf from '../../content/references/ap-chemistry-equations-sheet.pdf?url';
	import apComputerScienceAPdf from '../../content/references/ap-computer-science-a-java-quick-reference.pdf?url';
	import apComputerSciencePrinciplesPdf from '../../content/references/ap-computer-science-principles-exam-reference-sheet.pdf?url';
	import apEnvironmentalSciencePdf from '../../content/references/ap-environmental-science-exam-reference-sheet.pdf?url';
	import apPhysics1Pdf from '../../content/references/ap-physics-1-equations-sheet.pdf?url';
	import apPhysics2Pdf from '../../content/references/ap-physics-2-equations-sheet.pdf?url';
	import apPhysicsCMechanicsPdf from '../../content/references/ap-physics-c-mechanics-equations-sheet.pdf?url';
	import apPhysicsCEMPdf from '../../content/references/ap-physics-c-electricity-and-magnetism-equations-sheet.pdf?url';
	import apStatisticsPdf from '../../content/references/ap-statistics-formula-tables-sheet.pdf?url';

	import { resolve } from '$app/paths';

	type ReferenceSection = {
		heading: string;
		content: string;
	};

	type ReferenceSheetConfig = {
		title: string;
		pdf?: string;
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

	const sheetConfig = $derived(() => toolData[subject]?.referenceSheet ?? null);

	const referenceSheetUrlBySubject: Record<string, string> = {
		'AP Biology': apBiologyPdf,
		'AP Chemistry': apChemistryPdf,
		'AP Computer Science A': apComputerScienceAPdf,
		'AP Computer Science Principles': apComputerSciencePrinciplesPdf,
		'AP Environmental Science': apEnvironmentalSciencePdf,
		'AP Physics 1': apPhysics1Pdf,
		'AP Physics 2': apPhysics2Pdf,
		'AP Physics C: Mechanics': apPhysicsCMechanicsPdf,
		'AP Physics C: E&M': apPhysicsCEMPdf,
		'AP Statistics': apStatisticsPdf
	};

	const referenceSheetUrlByFileName: Record<string, string> = {
		'ap-biology-equations-and-formulas-sheet.pdf': apBiologyPdf,
		'ap-chemistry-equations-sheet.pdf': apChemistryPdf,
		'ap-computer-science-a-java-quick-reference.pdf': apComputerScienceAPdf,
		'ap-computer-science-principles-exam-reference-sheet.pdf': apComputerSciencePrinciplesPdf,
		'ap-environmental-science-exam-reference-sheet.pdf': apEnvironmentalSciencePdf,
		'ap-physics-1-equations-sheet.pdf': apPhysics1Pdf,
		'ap-physics-2-equations-sheet.pdf': apPhysics2Pdf,
		'ap-physics-c-mechanics-equations-sheet.pdf': apPhysicsCMechanicsPdf,
		'ap-physics-c-electricity-and-magnetism-equations-sheet.pdf': apPhysicsCEMPdf,
		'ap-statistics-formula-tables-sheet.pdf': apStatisticsPdf
	};

	const pdfUrl = $derived(() => {
		const fileUrl = sheetConfig?.pdf ? referenceSheetUrlByFileName[sheetConfig.pdf] : null;

		return fileUrl ?? referenceSheetUrlBySubject[subject] ?? null;
	});

	const resolvedPdfUrl = $derived(() => (pdfUrl ? resolve(pdfUrl) : null));
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-125">
		<Sheet.Header class="border-b border-border px-6 py-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<Sheet.Title class="text-base">
					{sheetConfig?.title ?? 'Reference Sheet'}
				</Sheet.Title>

				{#if resolvedPdfUrl}
					<a
						href={resolvedPdfUrl}
						target="_blank"
						rel="noreferrer noopener"
						class="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-accent hover:text-primary-foreground"
					>
						View PDF
					</a>
				{/if}
			</div>
		</Sheet.Header>

		<div class="flex-1 overflow-y-auto px-6 py-5">
			{#if sheetConfig && sheetConfig.sections?.length > 0}
				<div class="space-y-6">
					{#each sheetConfig.sections ?? [] as section (section.heading)}
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
			{:else if resolvedPdfUrl}
				<p class="text-sm text-muted-foreground">
					No preview sections are available for this subject. The full PDF is shown below.
				</p>
			{:else}
				<p class="text-sm text-muted-foreground">No reference sheet available for this subject.</p>
			{/if}

			{#if resolvedPdfUrl}
				<div class="mt-8">
					<div
						class="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between"
					>
						<div>
							<p class="text-sm font-semibold">Full PDF Reference</p>
							<p class="text-xs text-muted-foreground">Open or scroll within the sheet.</p>
						</div>

						<a
							href={resolvedPdfUrl}
							target="_blank"
							rel="noreferrer noopener"
							class="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-accent hover:text-primary-foreground"
						>
							Open PDF
						</a>
					</div>

					<div class="mt-4 min-h-160 overflow-hidden rounded-xl border border-border bg-background">
						<iframe src={resolvedPdfUrl} title="Reference Sheet PDF" class="h-full w-full"></iframe>
					</div>
				</div>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
