<script lang="ts">
	import ProgressDashboard from '$lib/components/progress/progress-dashboard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Progress | Free AP Practice</title>
</svelte:head>

<ProgressDashboard
	stats={data.stats}
	progress={data.progress}
	historyItems={data.historyItems}
	historyError={data.historyError}
	selectedSubjects={data.selectedSubjects ?? []}
/>
