<script lang="ts">
	import ProgressDashboard from '$lib/components/progress/progress-dashboard.svelte';
	import type { ProgressEntry, StatsData } from '$lib/users/types.js';

	let { data } = $props();
	const stats = $derived(data.stats as StatsData);
	const progress = $derived(data.progress as ProgressEntry[]);
</script>

<svelte:head>
	<title>Progress | Free AP Practice</title>
</svelte:head>

<ProgressDashboard {stats} {progress} selectedSubjects={data.selectedSubjects ?? []} />
