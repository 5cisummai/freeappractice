<script lang="ts">
	import RichText from '#lib/components/content/rich-text.svelte';
	import {
		SEO_SAMPLE_OPTION_LETTERS,
		sampleQuestionOptionText,
		type SeoSampleQuestion
	} from '#lib/seo/sample-questions.js';

	let { questions }: { questions: SeoSampleQuestion[] } = $props();
</script>

{#if questions.length > 0}
	<section class="mt-12 space-y-4" aria-labelledby="sample-questions-heading">
		<div class="space-y-1">
			<h2 id="sample-questions-heading" class="text-2xl font-semibold tracking-tight">
				Sample questions
			</h2>
			<p class="text-sm leading-6 text-muted-foreground">
				A few exam-style multiple-choice questions from this unit, with answers and explanations.
			</p>
		</div>

		<ol class="space-y-4">
			{#each questions as question, index (question.questionId)}
				<li
					class="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5"
					data-sample-question={question.questionId}
				>
					<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
						Question {index + 1}
					</p>
					<div class="mt-2 font-serif text-base leading-7 text-foreground">
						<RichText text={question.question} />
					</div>
					<ul class="mt-3 space-y-1.5">
						{#each SEO_SAMPLE_OPTION_LETTERS as letter (letter)}
							<li
								class="rounded-lg border px-3 py-2 {letter === question.correctAnswer
									? 'border-emerald-500/70 bg-emerald-500/10'
									: 'border-border/60'}"
							>
								<div class="flex gap-2.5">
									<span
										class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold {letter ===
										question.correctAnswer
											? 'border-emerald-500 bg-emerald-500 text-white'
											: 'border-border bg-muted/40 text-muted-foreground'}"
									>
										{letter}
									</span>
									<div class="min-w-0 flex-1 font-serif text-sm leading-6">
										<RichText text={sampleQuestionOptionText(question, letter)} />
										{#if letter === question.correctAnswer}
											<span class="sr-only">Correct answer</span>
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
					{#if question.explanation}
						<div class="mt-3 space-y-1 border-t border-border pt-3">
							<p class="text-xs font-medium text-emerald-700 dark:text-emerald-400">Explanation</p>
							<div class="font-serif text-sm leading-6 text-foreground/85">
								<RichText text={question.explanation} />
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	</section>
{/if}
