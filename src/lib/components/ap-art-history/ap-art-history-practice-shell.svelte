<script lang="ts">
	import WorkPracticeSelector from '#lib/components/ap-art-history/work-practice-selector.svelte';
	import WorkPracticeCard from '#lib/components/ap-art-history/work-practice-card.svelte';
	import { createWorkPracticeCore } from '#lib/components/ap-art-history/work-practice-core.svelte.js';
	import { cn } from '#lib/utils.js';

	let {
		presentation = 'hero'
	}: {
		presentation?: 'standard' | 'hero';
	} = $props();

	let selectedContentArea = $state('');
	let requestVersion = $state(0);

	const core = createWorkPracticeCore({
		getContentArea: () => selectedContentArea,
		getRequestVersion: () => requestVersion
	});

	function handlePractice(): void {
		requestVersion += 1;
	}
</script>

<div class="relative">
	<div
		class={cn('mx-auto mb-8 max-w-5xl', presentation === 'hero' && 'max-sm:px-4')}
		id="apah-practice-shell-controls"
	>
		<WorkPracticeSelector
			bind:selectedContentArea
			generateDisabled={core.isLoading}
			onGenerate={handlePractice}
		/>
	</div>

	<div class="mx-auto min-h-40 max-w-6xl">
		<WorkPracticeCard {core} />
	</div>
</div>
