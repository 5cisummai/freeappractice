<script lang="ts">
	import TutorWidget from '$lib/components/questions/tutor-widget.svelte';
	import type { TutorMode } from '$lib/question-bank/mcq/types.js';

	type QuestionTutorProps = {
		tutorMode?: TutorMode;
		course?: string;
		unit?: string;
		questionId?: string;
		frqQuestionId?: string;
		frqAttemptId?: string;
		topic?: string;
		showFirstUseHint?: boolean;
	};

	let {
		tutorMode = 'free',
		course = '',
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
		{course}
		{unit}
		{questionId}
		{frqQuestionId}
		{frqAttemptId}
		{topic}
		{showFirstUseHint}
	/>
{/if}
