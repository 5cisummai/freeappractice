<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from './$types';
	import ArrowLeftIcon from '@tabler/icons-svelte/icons/arrow-left';
	import BookOpenIcon from '@tabler/icons-svelte/icons/book-filled';
	import BrainIcon from '@tabler/icons-svelte/icons/brain';
	import CalendarCheckIcon from '@tabler/icons-svelte/icons/calendar-check';
	import CheckIcon from '@tabler/icons-svelte/icons/check-filled';
	import ChevronRightIcon from '@tabler/icons-svelte/icons/chevron-right';
	import SearchIcon from '@tabler/icons-svelte/icons/search';
	import SparklesIcon from '@tabler/icons-svelte/icons/sparkles-filled';
	import TargetIcon from '@tabler/icons-svelte/icons/target';
	import TrendingUpIcon from '@tabler/icons-svelte/icons/trending-up';
	import type { Component } from 'svelte';
	import logo from '$lib/assets/logo.png';
	import { onboardingSubjects } from '$lib/onboarding-subjects.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import {
		MINIMUM_ACCOUNT_AGE,
		earliestBirthDateForInput,
		isAtLeastAge,
		isValidBirthDate,
		localDateInputValue
	} from '$lib/auth/age.js';
	import type { OnboardingGoal } from '$lib/onboarding.js';
	import { authClient } from '$lib/auth/client.js';
	import BirthDatePicker from '$lib/components/auth/birth-date-picker.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		Field,
		FieldDescription,
		FieldError,
		FieldGroup,
		FieldLabel
	} from '$lib/components/ui/field/index.js';
	import { getSiteUrl } from '$lib/site-url.js';
	import { untrack } from 'svelte';

	let { data, form } = $props();

	type SetupStep = 'welcome' | 'subjects' | 'plan' | 'style' | 'memory';
	type TeachingStyle = 'socratic' | 'concise' | 'step_by_step';
	type StudyGoal = OnboardingGoal;

	const initialData = untrack(() => data);
	const superSetup = initialData.superSetup;
	const initialSuperAccess = superSetup?.planAccess.plan === 'super';
	const initialAgeConfirmed = Boolean(initialData.ageConfirmedAt);
	const welcomeName = initialData.userName?.trim().split(/\s+/)[0] || 'there';

	let selectedSubjects = $state([...initialData.selectedSubjects]);
	let superOptedIn = $state(initialData.superIntent);
	let superActivated = $state(initialSuperAccess);
	let ageConfirmed = $state(initialAgeConfirmed);
	let birthDate = $state('');
	let selectedGoals = $state<StudyGoal[]>([...initialData.selectedGoals]);
	let subjectSearch = $state('');
	let deletingAccount = $state(false);
	let teachingStyle = $state<TeachingStyle>(superSetup?.profile.teachingStyle ?? 'concise');
	let memoryEnabled = $state(Boolean(superSetup?.profile.memoryEnabled));
	let memoryDisclosureSeen = $state(Boolean(superSetup?.profile.memoryDisclosureSeenAt));
	let planChoice = $state<'free' | 'super'>('super');
	let currentStep = $state<SetupStep>(initialStep());
	let stepKey = $state(0);
	let saving = $state(false);
	let finishing = $state(false);
	let billingBusy = $state(false);
	let annual = $state(false);
	let memories = $state<Array<{ id: string; text: string; createdAt: string | null }>>([]);
	let memoryLoading = $state(false);
	let errorMessage = $state('');

	function initialStep(): SetupStep {
		return 'welcome';
	}

	const hasSuperAccess = $derived(superActivated);
	const needsPlan = $derived(superOptedIn && !hasSuperAccess);
	const steps = $derived.by(() => {
		const next: SetupStep[] = ['welcome', 'subjects'];
		if (superOptedIn) {
			if (needsPlan) next.push('plan');
			next.push('style', 'memory');
		}
		return next;
	});
	const stepIndex = $derived(Math.max(0, steps.indexOf(currentStep)));
	const current = $derived.by(() => {
		const content: Record<SetupStep, { title: string; description: string }> = {
			welcome: {
				title: `Welcome, ${welcomeName}!`,
				description: 'What are your goals?'
			},
			subjects: {
				title: 'What are you taking?',
				description: 'Choose the AP subjects you want to practice. You can change them anytime.'
			},
			plan: {
				title: 'Choose how you want to study',
				description: 'Keep the essentials free, or add a tutor that learns how you learn.'
			},
			style: {
				title: 'How should explanations feel?',
				description: 'Choose a starting style. You can change it whenever you want.'
			},
			memory: {
				title: 'Make progress feel personal',
				description:
					'Optionally let Super remember small learning preferences and recurring misconceptions.'
			}
		};
		return content[currentStep];
	});
	const isFirst = $derived(stepIndex === 0);
	const isLast = $derived(stepIndex === steps.length - 1);
	const canChooseSuper = Boolean(superSetup?.freeBetaEnabled || superSetup?.checkoutEnabled);
	const todayDate = localDateInputValue();
	const minBirthDate = earliestBirthDateForInput(todayDate);
	const birthDateIsValid = $derived(!birthDate || isValidBirthDate(birthDate, todayDate));
	const isOldEnough = $derived(
		ageConfirmed || isAtLeastAge(birthDate, MINIMUM_ACCOUNT_AGE, todayDate)
	);
	const isUnderAge = $derived(Boolean(birthDate) && birthDateIsValid && !isOldEnough);
	const needsAgeVerification = $derived(!ageConfirmed);
	const canContinueWelcome = $derived(selectedGoals.length > 0 && (ageConfirmed || isOldEnough));
	const asIcon = (icon: unknown) => icon as Component<{ class?: string }>;
	const filteredSubjects = $derived.by(() => {
		const query = subjectSearch.trim().toLowerCase();
		if (!query) return onboardingSubjects;

		return onboardingSubjects.filter(
			(subject) =>
				subject.name.toLowerCase().includes(query) ||
				subject.description.toLowerCase().includes(query)
		);
	});
	const studyGoalOptions: Array<{
		value: StudyGoal;
		icon: Component<{ class?: string }>;
		title: string;
		detail: string;
		checkedClass: string;
		iconClass: string;
	}> = [
		{
			value: 'score_higher',
			icon: asIcon(TrendingUpIcon),
			title: 'Score higher',
			detail: 'Push for a better result on exam day.',
			checkedClass:
				'has-[:checked]:border-emerald-400/70 has-[:checked]:bg-emerald-500/15 has-[:checked]:[&_.goal-icon]:bg-emerald-500 has-[:checked]:[&_.goal-icon]:text-white has-[:checked]:[&_.selection-check]:border-emerald-500 has-[:checked]:[&_.selection-check]:text-emerald-600 dark:has-[:checked]:[&_.selection-check]:text-emerald-400',
			iconClass: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
		},
		{
			value: 'exam_prep',
			icon: asIcon(TargetIcon),
			title: 'Prepare for exam day',
			detail: 'Build confidence with realistic practice.',
			checkedClass:
				'has-[:checked]:border-sky-400/70 has-[:checked]:bg-sky-500/15 has-[:checked]:[&_.goal-icon]:bg-sky-500 has-[:checked]:[&_.goal-icon]:text-white has-[:checked]:[&_.selection-check]:border-sky-500 has-[:checked]:[&_.selection-check]:text-sky-600 dark:has-[:checked]:[&_.selection-check]:text-sky-400',
			iconClass: 'bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100'
		},
		{
			value: 'weak_topics',
			icon: asIcon(BrainIcon),
			title: 'Strengthen weak topics',
			detail: 'Focus on the units that need the most work.',
			checkedClass:
				'has-[:checked]:border-amber-400/70 has-[:checked]:bg-amber-500/15 has-[:checked]:[&_.goal-icon]:bg-amber-500 has-[:checked]:[&_.goal-icon]:text-white has-[:checked]:[&_.selection-check]:border-amber-500 has-[:checked]:[&_.selection-check]:text-amber-600 dark:has-[:checked]:[&_.selection-check]:text-amber-400',
			iconClass: 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
		},
		{
			value: 'stay_consistent',
			icon: asIcon(CalendarCheckIcon),
			title: 'Stay consistent',
			detail: 'Keep a steady study rhythm through the year.',
			checkedClass:
				'has-[:checked]:border-violet-400/70 has-[:checked]:bg-violet-500/15 has-[:checked]:[&_.goal-icon]:bg-violet-500 has-[:checked]:[&_.goal-icon]:text-white has-[:checked]:[&_.selection-check]:border-violet-500 has-[:checked]:[&_.selection-check]:text-violet-600 dark:has-[:checked]:[&_.selection-check]:text-violet-400',
			iconClass: 'bg-violet-200 text-violet-900 dark:bg-violet-900 dark:text-violet-100'
		}
	];

	function toggleGoal(goal: StudyGoal, checked: boolean) {
		if (checked) {
			if (!selectedGoals.includes(goal)) selectedGoals = [...selectedGoals, goal];
			return;
		}

		selectedGoals = selectedGoals.filter((selected) => selected !== goal);
	}

	function toggleSubject(subject: string, checked: boolean) {
		if (checked) {
			if (!selectedSubjects.includes(subject)) selectedSubjects = [...selectedSubjects, subject];
			return;
		}

		selectedSubjects = selectedSubjects.filter((selected) => selected !== subject);
	}

	function wait(milliseconds: number): Promise<void> {
		return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
	}

	function goTo(next: SetupStep) {
		if (!steps.includes(next)) return;
		currentStep = next;
		stepKey += 1;
		if (next === 'memory' && hasSuperAccess) {
			void loadMemories().catch((error) => {
				errorMessage = error instanceof Error ? error.message : 'Could not load saved memories.';
			});
		}
	}

	function goBack() {
		const previous = steps[stepIndex - 1];
		if (previous) goTo(previous);
	}

	async function saveSubjects() {
		const response = await apiFetch('/api/me/subjects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ subjects: selectedSubjects })
		});
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) throw new Error(getResponseMessage(result, 'Could not save your subjects.'));
	}

	async function confirmAge() {
		if (ageConfirmed) return;
		const response = await apiFetch('/api/super/confirm-age', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ birthDate })
		});
		const result = await readJsonOrNull<{ error?: string; underAge?: boolean }>(response);
		if (!response.ok)
			throw new Error(getResponseMessage(result, 'Could not record your confirmation.'));
		ageConfirmed = true;
	}

	async function deleteUnder13Account() {
		if (deletingAccount) return;
		deletingAccount = true;
		try {
			const { data: deletion, error } = await authClient.deleteUser({
				callbackURL: `${getSiteUrl()}/`
			});
			if (error) throw new Error(error.message ?? 'Could not start account deletion.');
			if (deletion?.message === 'Verification email sent') {
				errorMessage = 'Check your email to confirm account deletion.';
				return;
			}
			window.location.href = '/';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not start account deletion.';
		} finally {
			deletingAccount = false;
		}
	}

	async function claimFreeBeta() {
		const response = await apiFetch('/api/super/claim-free-beta', { method: 'POST' });
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) throw new Error(getResponseMessage(result, 'Could not unlock Super.'));
		superActivated = true;
	}

	async function saveProfile() {
		const response = await apiFetch('/api/super/profile', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ teachingStyle, memoryEnabled })
		});
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok)
			throw new Error(getResponseMessage(result, 'Could not save your preferences.'));
	}

	async function acknowledgeMemory() {
		if (memoryDisclosureSeen) return;
		const response = await apiFetch('/api/super/memory', { method: 'POST' });
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok)
			throw new Error(getResponseMessage(result, 'Could not save your memory preference.'));
		memoryDisclosureSeen = true;
	}

	async function loadMemories() {
		if (memoryLoading) return;
		memoryLoading = true;
		try {
			const response = await apiFetch('/api/super/memory');
			const result = await readJsonOrNull<{
				memories?: Array<{ id: string; text: string; createdAt: string | null }>;
				error?: string;
			}>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(result, 'Could not load saved memories.'));
			memories = result?.memories ?? [];
		} finally {
			memoryLoading = false;
		}
	}

	async function startCheckout() {
		if (billingBusy || !superSetup?.checkoutEnabled) return;
		billingBusy = true;
		try {
			const { data: checkout, error } = await authClient.subscription.upgrade({
				plan: 'super',
				annual,
				successUrl: `${window.location.origin}${resolve('/app/onboarding')}?super=1&checkout=success`,
				cancelUrl: `${window.location.origin}${resolve('/pricing')}`,
				returnUrl: `${window.location.origin}${resolve('/app/onboarding')}?super=1`,
				...(superSetup.billing?.subscriptionId
					? { subscriptionId: superSetup.billing.subscriptionId }
					: {}),
				disableRedirect: true
			});
			if (error || !checkout?.url) throw new Error(error?.message ?? 'Could not start checkout.');
			window.location.assign(checkout.url);
		} finally {
			billingBusy = false;
		}
	}

	function submitFinish() {
		if (finishing) return;
		finishing = true;
		(document.getElementById('onboarding-form') as HTMLFormElement | null)?.requestSubmit();
	}

	async function advance() {
		if (saving || finishing) return;
		errorMessage = '';
		saving = true;
		try {
			if (currentStep === 'welcome') {
				if (selectedGoals.length === 0) {
					errorMessage = 'Choose at least one goal to continue.';
					return;
				}
				if (needsAgeVerification) {
					if (isUnderAge) {
						errorMessage = `Free AP Practice is for students ${MINIMUM_ACCOUNT_AGE} and older.`;
						return;
					}
					if (!isOldEnough) {
						errorMessage = 'Enter your birth date to continue.';
						return;
					}
					await confirmAge();
				}
				goTo('subjects');
				return;
			}

			if (currentStep === 'subjects') {
				if (selectedSubjects.length === 0) {
					errorMessage = 'Choose at least one subject to continue.';
					return;
				}
				if (superOptedIn) {
					await saveSubjects();
					goTo(needsPlan ? 'plan' : 'style');
				} else submitFinish();
				return;
			}

			if (currentStep === 'plan') {
				if (planChoice === 'free') {
					superOptedIn = false;
					submitFinish();
					return;
				}
				if (!canChooseSuper) {
					errorMessage = 'Super checkout is temporarily unavailable. You can continue with Free.';
					return;
				}
				if (superSetup?.freeBetaEnabled) await claimFreeBeta();
				else {
					await startCheckout();
					return;
				}
				goTo('style');
				return;
			}

			if (currentStep === 'style') {
				await saveProfile();
				goTo('memory');
				return;
			}

			await saveProfile();
			await acknowledgeMemory();
			submitFinish();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not continue.';
		} finally {
			saving = false;
		}
	}

	function skipSuperSetup() {
		superOptedIn = false;
		submitFinish();
	}

	const handleSubmit: SubmitFunction = () => {
		finishing = true;
		return async ({ result, update }) => {
			if (result.type === 'redirect') {
				await wait(280);
				await update();
				return;
			}
			finishing = false;
			await update();
		};
	};
</script>

<svelte:head>
	<title>Set up your study space | Free AP Practice</title>
</svelte:head>

<div
	class="flex min-h-svh items-center justify-center bg-background px-5 py-8 text-foreground sm:px-8"
>
	<div class="w-full max-w-3xl">
		<form
			id="onboarding-form"
			method="POST"
			use:enhance={handleSubmit}
			class="flex min-h-[32rem] flex-col gap-8 rounded-3xl bg-background p-6 sm:min-h-[40rem] sm:gap-10 sm:p-8"
		>
			<header class="flex items-center justify-between gap-4">
				<div class="flex items-center gap-2 text-sm font-semibold tracking-tight">
					<img src={logo} alt="" class="size-7 rounded-full" />
					<span>Free AP Practice</span>
				</div>
				<div class="flex items-center gap-3 text-muted-foreground">
					<div class="flex items-center gap-1.5" aria-label="Onboarding progress">
						{#each steps as step, index (step)}
							<span
								class="size-2 rounded-full {index === stepIndex
									? 'bg-primary'
									: index < stepIndex
										? 'bg-primary/40'
										: 'bg-muted-foreground/20'}"
								aria-hidden="true"
							></span>
						{/each}
					</div>
					<span class="text-xs tabular-nums">{stepIndex + 1} of {steps.length}</span>
				</div>
			</header>

			{#each selectedSubjects as subject (subject)}
				<input type="hidden" name="subjects" value={subject} />
			{/each}
			{#each selectedGoals as goal (goal)}
				<input type="hidden" name="goals" value={goal} />
			{/each}

			{#key stepKey}
				<section
					class="flex flex-1 animate-in flex-col gap-8 duration-500 fade-in slide-in-from-bottom-3 motion-reduce:animate-none sm:gap-10"
				>
					<div
						class="mx-auto flex w-full flex-1 flex-col {currentStep === 'subjects'
							? 'max-w-none'
							: 'max-w-3xl'}"
					>
						<div class="text-center">
							<h1
								class="font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl"
							>
								{current.title}
							</h1>
							<p class="mt-2 text-base text-muted-foreground sm:text-lg">
								{current.description}
							</p>
						</div>

						<div class="mt-8">
							{#if currentStep === 'subjects'}
								<div class="space-y-6">
									<div class="relative">
										<SearchIcon
											class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
											aria-hidden="true"
										/>
										<Input
											type="search"
											placeholder="Search AP subjects"
											bind:value={subjectSearch}
											class="pl-9"
											aria-label="Search AP subjects"
										/>
									</div>
									{#if filteredSubjects.length === 0}
										<p class="py-8 text-center text-sm text-muted-foreground">
											No subjects match "{subjectSearch.trim()}".
										</p>
									{:else}
										<div class="grid grid-cols-2 gap-2 lg:grid-cols-3">
											{#each filteredSubjects as subject (subject.name)}
												{@const SubjectIcon = subject.icon}
												<label
													class="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-transparent bg-muted/50 px-4 py-3 text-sm transition-colors duration-200 hover:bg-muted/80 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:checked]:[&_.selection-check]:opacity-100 {subject.checkedClass}"
												>
													<input
														type="checkbox"
														value={subject.name}
														checked={selectedSubjects.includes(subject.name)}
														onchange={(event) =>
															toggleSubject(
																subject.name,
																(event.currentTarget as HTMLInputElement).checked
															)}
														class="sr-only"
													/>
													<span
														class="subject-icon flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors {subject.iconClass}"
														><SubjectIcon class="size-4" /></span
													>
													<span class="min-w-0 flex-1 font-medium">{subject.name}</span>
													<span
														class="selection-check flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-primary opacity-0 transition-opacity"
														aria-hidden="true"><CheckIcon class="size-3" /></span
													>
												</label>
											{/each}
										</div>
									{/if}
									<p class="text-center text-sm text-muted-foreground">
										{selectedSubjects.length}
										{selectedSubjects.length === 1 ? 'subject' : 'subjects'} selected
									</p>
								</div>
							{:else if currentStep === 'welcome'}
								<div class="mx-auto w-full">
									<div class="grid gap-3 sm:grid-cols-2">
										{#each studyGoalOptions as option (option.value)}
											{@const GoalIcon = option.icon}
											<label
												class="flex min-h-28 cursor-pointer flex-col justify-between rounded-2xl border border-transparent bg-muted/50 p-4 text-left transition-colors duration-200 hover:bg-muted/80 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:checked]:[&_.selection-check]:opacity-100 {option.checkedClass}"
											>
												<input
													type="checkbox"
													value={option.value}
													checked={selectedGoals.includes(option.value)}
													onchange={(event) =>
														toggleGoal(
															option.value,
															(event.currentTarget as HTMLInputElement).checked
														)}
													class="sr-only"
												/>
												<span class="flex items-start justify-between gap-3">
													<span
														class="goal-icon flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors {option.iconClass}"
													>
														<GoalIcon class="size-4" />
													</span>
													<span
														class="selection-check flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-primary opacity-0 transition-opacity"
														aria-hidden="true"
													>
														<CheckIcon class="size-3" />
													</span>
												</span>
												<span class="mt-4">
													<span class="block text-sm font-medium">{option.title}</span>
													<span class="mt-1 block text-xs leading-5 text-muted-foreground">
														{option.detail}
													</span>
												</span>
											</label>
										{/each}
									</div>
									{#if needsAgeVerification}
										<FieldGroup class="mt-8">
											<Field
												data-invalid={isUnderAge || (!birthDateIsValid && birthDate)
													? true
													: undefined}
											>
												<FieldLabel for="onboarding-birth-date">Birth date</FieldLabel>
												<BirthDatePicker
													id="onboarding-birth-date"
													bind:value={birthDate}
													min={minBirthDate}
													max={todayDate}
													aria-invalid={isUnderAge || (!birthDateIsValid && Boolean(birthDate))}
												/>
												{#if isUnderAge}
													<FieldError
														>You must be at least {MINIMUM_ACCOUNT_AGE} to use Free AP Practice.</FieldError
													>
												{:else if birthDate && !birthDateIsValid}
													<FieldError>Enter a valid birth date.</FieldError>
												{:else}
													<FieldDescription>
														We use this to confirm you are {MINIMUM_ACCOUNT_AGE} or older. We save the
														confirmation, not your birth date.
													</FieldDescription>
												{/if}
											</Field>
										</FieldGroup>
										{#if isUnderAge}
											<p class="mt-4 text-center text-sm text-muted-foreground">
												If you are under {MINIMUM_ACCOUNT_AGE}, do not continue. Start deletion and
												follow the email instructions to remove this account.
											</p>
											<div class="mt-3 flex justify-center">
												<Button
													type="button"
													variant="ghost"
													onclick={deleteUnder13Account}
													disabled={deletingAccount}
													>{deletingAccount
														? 'Starting deletion…'
														: `I am under ${MINIMUM_ACCOUNT_AGE}`}</Button
												>
											</div>
										{/if}
									{/if}
								</div>
							{:else if currentStep === 'plan'}
								<div class="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
									<button
										type="button"
										onclick={() => (planChoice = 'free')}
										class="rounded-3xl border p-6 text-left transition-all {planChoice === 'free'
											? 'border-primary bg-primary/5 shadow-sm'
											: 'border-border/70 bg-background/60 hover:border-primary/40'}"
									>
										<div class="flex items-start justify-between gap-4">
											<div>
												<BookOpenIcon class="size-5 text-primary" />
												<h2 class="mt-5 font-display text-2xl font-medium">Keep it free</h2>
												<p class="mt-2 text-sm leading-6 text-muted-foreground">
													Unlimited AP practice, feedback, progress, and the standard tutor.
												</p>
											</div>
											{#if planChoice === 'free'}<CheckIcon class="size-5 text-primary" />{/if}
										</div>
									</button>
									<button
										type="button"
										onclick={() => (planChoice = 'super')}
										disabled={!canChooseSuper}
										class="rounded-3xl border p-6 text-left transition-all {planChoice === 'super'
											? 'border-violet-400 bg-violet-500/10 shadow-sm'
											: 'border-violet-300/50 bg-violet-500/5 hover:border-violet-400'} disabled:cursor-not-allowed disabled:opacity-50"
									>
										<div class="flex items-start justify-between gap-4">
											<div>
												<SparklesIcon class="size-5 text-violet-500" />
												<h2 class="mt-5 font-display text-2xl font-medium">Super</h2>
												<p class="mt-2 text-sm leading-6 text-muted-foreground">
													{superSetup?.freeBetaEnabled
									? 'Personalized tutoring, Coach, and study plans during the beta.'
														: '$9/month or $79/year for the full personalized study toolkit.'}
												</p>
											</div>
											{#if planChoice === 'super'}<CheckIcon class="size-5 text-violet-500" />{/if}
										</div>
									</button>
								</div>
								{#if !superSetup?.freeBetaEnabled && superSetup?.checkoutEnabled}<div
										class="mt-4 flex justify-center gap-2"
									>
										<Button
											type="button"
											size="sm"
											variant={annual ? 'outline' : 'default'}
											onclick={() => (annual = false)}>Monthly</Button
										><Button
											type="button"
											size="sm"
											variant={annual ? 'default' : 'outline'}
											onclick={() => (annual = true)}>Yearly</Button
										>
									</div>{/if}
							{:else if currentStep === 'style'}
								<div class="mx-auto grid max-w-3xl gap-3">
									{#each [{ value: 'socratic' as const, title: 'Socratic hints', detail: 'Guiding questions that help you reason it out.' }, { value: 'concise' as const, title: 'Concise explanations', detail: 'Short, direct answers when you want clarity fast.' }, { value: 'step_by_step' as const, title: 'Step by step', detail: 'Walk through problems in ordered stages.' }] as option (option.value)}
										{@const selected = teachingStyle === option.value}
										<button
											type="button"
											onclick={() => (teachingStyle = option.value)}
											class="flex items-start gap-4 rounded-2xl border p-5 text-left transition-all {selected
												? 'border-primary bg-primary/5 shadow-sm'
												: 'border-border/70 bg-background/60 hover:border-primary/40'}"
											><BrainIcon class="mt-0.5 size-5 shrink-0 text-primary" /><span class="flex-1"
												><span class="block font-medium">{option.title}</span><span
													class="mt-1 block text-sm leading-6 text-muted-foreground"
													>{option.detail}</span
												></span
											>{#if selected}<CheckIcon class="size-5 text-primary" />{/if}</button
										>
									{/each}
								</div>
							{:else if currentStep === 'memory'}
								<div class="mx-auto max-w-3xl space-y-4">
									<button
										type="button"
										onclick={() => (memoryEnabled = !memoryEnabled)}
										class="flex w-full items-center justify-between gap-4 rounded-2xl border p-5 text-left transition-all {memoryEnabled
											? 'border-primary bg-primary/5'
											: 'border-border/70 bg-background/60 hover:border-primary/40'}"
										><span
											><span class="block font-medium">Personalized memory</span><span
												class="mt-1 block text-sm leading-6 text-muted-foreground"
												>Remember learning preferences and recurring misconceptions, never full
												chats.</span
											></span
										><span
											class="flex size-6 shrink-0 items-center justify-center rounded-full border {memoryEnabled
												? 'border-primary bg-primary text-primary-foreground'
												: 'border-border'}"
											>{#if memoryEnabled}<CheckIcon class="size-4" />{/if}</span
										></button
									>
									{#if !memoryDisclosureSeen}<p
											class="rounded-2xl border border-border/70 bg-muted/40 px-5 py-4 text-sm leading-6 text-muted-foreground"
										>
											You can pause memory, review every saved fact, or delete everything from
											Settings at any time.
										</p>{/if}
									{#if memoryLoading}<p class="text-sm text-muted-foreground">
											Loading saved memories…
										</p>{:else if memories.length}<p class="text-sm text-muted-foreground">
											{memories.length} saved {memories.length === 1
												? 'learning fact'
												: 'learning facts'}.
										</p>{/if}
								</div>
							{/if}
						</div>

						{#if errorMessage || form?.error}<p
								class="mt-6 text-center text-sm text-destructive"
								role="alert"
							>
								{errorMessage || form?.error}
							</p>{/if}
					</div>

					<div class="flex items-center justify-between gap-3">
						<div class="flex items-center gap-1">
							{#if !isFirst}<Button
									type="button"
									variant="ghost"
									onclick={goBack}
									disabled={saving || finishing || billingBusy}
									><ArrowLeftIcon class="size-4" /> Back</Button
								>{/if}{#if data.superIntent && currentStep !== 'subjects' && currentStep !== 'welcome'}<Button
									type="button"
									variant="ghost"
									onclick={skipSuperSetup}
									disabled={saving || finishing || billingBusy}>Skip Super setup</Button
								>{/if}
						</div>
						<Button
							type="button"
							size="lg"
							onclick={advance}
							disabled={saving ||
								finishing ||
								billingBusy ||
								(currentStep === 'welcome' && !canContinueWelcome)}
							>{#if saving || billingBusy}Saving…{:else if finishing}Opening your dashboard…{:else if currentStep === 'plan' && planChoice === 'super'}{superSetup?.freeBetaEnabled
									? 'Unlock Super'
									: 'Continue to checkout'}{:else if isLast}Finish setup{:else}Continue{/if}{#if !saving && !billingBusy && !finishing}<ChevronRightIcon
									class="size-4"
								/>{/if}</Button
						>
					</div>
				</section>
			{/key}
		</form>
	</div>
</div>
