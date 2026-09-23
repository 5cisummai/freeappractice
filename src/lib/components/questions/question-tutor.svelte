<script lang="ts">
	import TutorWidget from '$lib/components/questions/tutor-widget.svelte';
	import type { TutorMode } from '$lib/question-bank/mcq/types.js';

	type QuestionTutorProps = {
		tutorMode?: TutorMode;
		apClass?: string;
		unit?: string;
		questionId?: string;
		frqQuestionId?: string;
		frqAttemptId?: string;
		topic?: string;
		showFirstUseHint?: boolean;
	};

	let {
		tutorMode = 'free',
		apClass = '',
		unit = '',
		questionId = '',
		frqQuestionId = '',
		frqAttemptId = '',
		topic = '',
		showFirstUseHint = false
	}: QuestionTutorProps = $props();
</script>

{#if tutorMode !== 'hidden'}
	<TutorWidget
		{apClass}
		{unit}
		{questionId}
		{frqQuestionId}
		{frqAttemptId}
		{topic}
		{showFirstUseHint}
	/>
{/if}
