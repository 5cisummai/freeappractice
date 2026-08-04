<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from './$types';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/ui/button/index.js';
	import logo from '$lib/assets/logo.png';
	import { onboardingSubjectGroups } from '$lib/onboarding-subjects.js';

	let { data, form } = $props();

	const selectedSubjects = $derived(new Set(data.selectedSubjects));
	let isSubmitting = $state(false);
	let isLeaving = $state(false);

	function subjectId(subject: string): string {
		return `subject-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
	}

	function wait(milliseconds: number): Promise<void> {
		return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
	}

	const handleSubmit: SubmitFunction = () => {
		isSubmitting = true;

		return async ({ result, update }) => {
			if (result.type === 'redirect') {
				isLeaving = true;
				await wait(420);
				await goto(resolve('/app'), { invalidateAll: true });
				return;
			}

			isSubmitting = false;
			await update();
		};
	};
</script>

<svelte:head>
	<title>Choose Your Subjects – Free AP Practice</title>
</svelte:head>

<div class:leaving={isLeaving} class="onboarding-shell min-h-svh px-5 py-8 sm:px-8 sm:py-10">
	<div class="mx-auto w-full max-w-5xl">
		<header
			class="onboarding-enter flex items-center justify-between"
			style="--onboarding-delay: 0ms"
		>
			<div class="flex items-center gap-2 font-medium tracking-tight">
				<img src={logo} alt="Free AP Practice" class="size-7 rounded-sm" />
				<span>Free AP Practice</span>
			</div>
			<span
				class="rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground"
			>
				Step 1 of 1
			</span>
		</header>

		<div class="mx-auto mt-12 max-w-4xl space-y-8 sm:mt-16">
			<div class="onboarding-enter space-y-3 text-center" style="--onboarding-delay: 100ms">
				<h1
					class="font-display text-4xl leading-[1.08] font-medium tracking-tight text-balance sm:text-5xl"
				>
					What are you taking?
				</h1>
				<p class="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
					Choose the AP subjects you want to practice. You can change this later.
				</p>
			</div>

			<form
				method="POST"
				use:enhance={handleSubmit}
				class="space-y-6"
				aria-busy={isSubmitting || isLeaving}
			>
				<div class="onboarding-enter space-y-8" style="--onboarding-delay: 180ms">
					{#each onboardingSubjectGroups as group, groupIndex (group.label)}
						<section
							class="onboarding-enter space-y-3"
							style="--onboarding-delay: {260 + groupIndex * 70}ms"
							aria-labelledby={subjectId(group.label)}
						>
							<div class="flex items-center gap-3">
								<h2
									id={subjectId(group.label)}
									class="font-display text-lg font-medium tracking-tight"
								>
									{group.label}
								</h2>
								<span class="text-xs text-muted-foreground">
									{group.subjects.length}
									{group.subjects.length === 1 ? 'subject' : 'subjects'}
								</span>
							</div>
							<div class="grid gap-2 sm:grid-cols-2">
								{#each group.subjects as subject, subjectIndex (subject.name)}
									{@const id = subjectId(subject.name)}
									{@const SubjectIcon = subject.icon}
									<div
										class="onboarding-enter"
										style="--onboarding-delay: {320 + groupIndex * 70 + subjectIndex * 25}ms"
									>
										<input
											{id}
											type="checkbox"
											name="subjects"
											value={subject.name}
											class="peer sr-only"
											checked={selectedSubjects.has(subject.name)}
										/>
										<label
											for={id}
											class="flex min-h-16 cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm transition-colors peer-checked:border-primary peer-checked:bg-primary/5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:border-primary/50 hover:bg-primary/5 peer-checked:[&_.selection-check]:opacity-100 peer-checked:[&_.subject-icon]:bg-primary peer-checked:[&_.subject-icon]:text-primary-foreground"
										>
											<span
												class="subject-icon flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors"
											>
												<SubjectIcon class="size-4" />
											</span>
											<span class="min-w-0 flex-1 leading-tight font-medium">{subject.name}</span>
											<span
												class="selection-check flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-primary opacity-0 transition-opacity"
												aria-hidden="true"
											>
												<CheckIcon class="size-3" />
											</span>
										</label>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				</div>

				{#if form?.error}
					<p class="text-center text-sm text-destructive" role="alert">{form.error}</p>
				{/if}

				<div
					class="onboarding-enter flex flex-col-reverse items-center justify-between gap-3 sm:flex-row"
					style="--onboarding-delay: 500ms"
				>
					<p class="text-center text-sm text-muted-foreground sm:text-left">
						You can update your subjects anytime from Settings.
					</p>
					<Button type="submit" size="lg" disabled={isSubmitting || isLeaving}>
						{isLeaving ? 'Opening your dashboard…' : isSubmitting ? 'Saving…' : 'Continue'}
					</Button>
				</div>
			</form>
		</div>
	</div>
</div>

<style>
	@keyframes onboarding-rise {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.onboarding-shell {
		opacity: 1;
		transition: opacity 420ms ease;
	}

	.onboarding-shell.leaving {
		opacity: 0;
		pointer-events: none;
	}

	.onboarding-enter {
		animation: onboarding-rise 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: var(--onboarding-delay, 0ms);
	}

	@media (prefers-reduced-motion: reduce) {
		.onboarding-shell {
			transition: none;
		}

		.onboarding-enter {
			animation: none;
		}
	}
</style>
