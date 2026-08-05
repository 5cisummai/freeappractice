<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PricingCards from '$lib/components/marketing/pricing-cards.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import logo from '$lib/assets/logo.png';
	import { authClient } from '$lib/auth/client.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	type TeachingStyle = 'socratic' | 'concise' | 'step_by_step';
	type SetupStep = 'age' | 'plan' | 'style' | 'memory';

	const BASE_STEPS: { id: SetupStep; label: string; title: string; description: string }[] = [
		{
			id: 'age',
			label: 'Age',
			title: 'Confirm you are 13 or older',
			description:
				'Super’s personalized AI tools are for students aged 13+. We store only a confirmation timestamp, not your birth date.'
		},
		{
			id: 'plan',
			label: 'Plan',
			title: 'Choose your plan',
			description: 'Stay on Free, or upgrade to Super for a tutor that learns how you learn.'
		}
	];

	const SUPER_STEPS: { id: SetupStep; label: string; title: string; description: string }[] = [
		{
			id: 'style',
			label: 'Style',
			title: 'How should the tutor teach?',
			description:
				'Pick a default teaching style. Coach and the tutor will follow this unless you change it.'
		},
		{
			id: 'memory',
			label: 'Memory',
			title: 'Personalized memory',
			description:
				'Optionally let the tutor remember small learning facts — never full chats. You stay in control.'
		}
	];

	function createForm() {
		return {
			teachingStyle: data.profile.teachingStyle as TeachingStyle,
			memoryEnabled: Boolean(data.profile.memoryEnabled),
			ageConfirmed: Boolean(data.profile.ageConfirmedAt),
			disclosureSeen: Boolean(data.profile.memoryDisclosureSeenAt)
		};
	}

	const isSuperMember = $derived(data.entitlements.plan === 'super');

	function defaultStep(): SetupStep {
		if (!data.profile.ageConfirmedAt) return 'age';
		if (data.entitlements.plan !== 'super') return 'plan';
		if (!data.profile.memoryDisclosureSeenAt) return 'style';
		return 'style';
	}

	let form = $state(createForm());
	let step = $state<SetupStep>(defaultStep());
	let optedIntoSuper = $state(false);
	let saving = $state(false);
	let billingBusy = $state(false);
	let annual = $state(false);
	let memories = $state<Array<{ id: string; text: string; createdAt: string | null }>>([]);
	let memoryLoading = $state(false);
	let stepKey = $state(0);

	const steps = $derived(
		optedIntoSuper || isSuperMember ? [...BASE_STEPS, ...SUPER_STEPS] : BASE_STEPS
	);
	const stepIndex = $derived(steps.findIndex((entry) => entry.id === step));
	const current = $derived.by(() => {
		const entry = steps[stepIndex] ?? steps[0];
		if (entry.id !== 'plan' || !isSuperMember) return entry;
		return {
			...entry,
			title: 'Your Super plan',
			description: 'You’re on Super. Manage billing, or continue setting up your tutoring profile.'
		};
	});
	const isFirst = $derived(stepIndex <= 0);
	const isLast = $derived(stepIndex >= steps.length - 1);
	const skipHref = $derived(isSuperMember ? resolve('/app/coach') : resolve('/app'));
	const continueHref = $derived(isSuperMember ? resolve('/app/coach') : resolve('/app'));

	onMount(() => {
		if (window.location.hash === '#tutor-memory') {
			optedIntoSuper = true;
			goTo('memory');
		} else if (step === 'memory' && isSuperMember) {
			void loadMemories();
		}
	});

	async function loadMemories() {
		if (!isSuperMember) {
			memories = [];
			return;
		}
		memoryLoading = true;
		try {
			const response = await apiFetch('/api/super/memory');
			const result = await readJsonOrNull<{ memories?: typeof memories; error?: string }>(response);
			if (!response.ok) throw new Error(getResponseMessage(result, 'Could not load tutor memory.'));
			memories = result?.memories ?? [];
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not load tutor memory.');
		} finally {
			memoryLoading = false;
		}
	}

	async function deleteMemory(id: string) {
		const response = await apiFetch(`/api/super/memory/${encodeURIComponent(id)}`, {
			method: 'DELETE'
		});
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			toast.error(getResponseMessage(result, 'Could not delete that memory.'));
			return;
		}
		memories = memories.filter((memory) => memory.id !== id);
		toast.success('Tutor memory deleted.');
	}

	async function deleteAllMemories() {
		if (!confirm('Delete every saved tutor memory? This cannot be undone.')) return;
		const response = await apiFetch('/api/super/memory', { method: 'DELETE' });
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			toast.error(getResponseMessage(result, 'Could not delete tutor memories.'));
			return;
		}
		memories = [];
		toast.success('All tutor memories deleted.');
	}

	function goTo(next: SetupStep) {
		if (SUPER_STEPS.some((entry) => entry.id === next)) {
			optedIntoSuper = true;
		}
		step = next;
		stepKey += 1;
		if (next === 'memory') {
			if (isSuperMember) void loadMemories();
			history.replaceState(null, '', '#tutor-memory');
		} else if (typeof window !== 'undefined' && window.location.hash) {
			history.replaceState(null, '', window.location.pathname + window.location.search);
		}
	}

	function goBack() {
		if (isFirst) return;
		const previous = steps[stepIndex - 1];
		if (previous) goTo(previous.id);
	}

	async function saveProfile() {
		const response = await apiFetch('/api/super/profile', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				teachingStyle: form.teachingStyle,
				memoryEnabled: form.memoryEnabled
			})
		});
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			throw new Error(getResponseMessage(result, 'Could not save your Super profile.'));
		}
	}

	async function confirmAge() {
		const response = await apiFetch('/api/super/confirm-age', { method: 'POST' });
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			throw new Error(getResponseMessage(result, 'Could not record your confirmation.'));
		}
		form.ageConfirmed = true;
	}

	async function acknowledgeMemory() {
		if (form.disclosureSeen) return;
		const response = await apiFetch('/api/super/memory', { method: 'POST' });
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			throw new Error(getResponseMessage(result, 'Could not save your memory preference.'));
		}
		form.disclosureSeen = true;
	}

	function continueWithSuper() {
		optedIntoSuper = true;
		goTo('style');
	}

	async function advance() {
		if (saving) return;
		saving = true;
		try {
			if (step === 'age') {
				if (!form.ageConfirmed) await confirmAge();
			} else if (step === 'plan') {
				if (isSuperMember) {
					goTo('style');
					return;
				}
				window.location.assign(resolve('/app'));
				return;
			} else if (step === 'style') {
				await saveProfile();
			} else if (step === 'memory') {
				await saveProfile();
				await acknowledgeMemory();
				if (!isSuperMember && data.checkoutEnabled) {
					await startCheckout();
					return;
				}
				window.location.assign(continueHref);
				return;
			} else {
				const _exhaustive: never = step;
				void _exhaustive;
			}

			if (isLast) {
				window.location.assign(continueHref);
				return;
			}

			const next = steps[stepIndex + 1];
			if (next) goTo(next.id);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not continue.');
		} finally {
			saving = false;
		}
	}

	async function startCheckout() {
		if (billingBusy) return;
		if (!form.ageConfirmed) {
			toast.error('Confirm that you are at least 13 before choosing Super.');
			goTo('age');
			return;
		}
		billingBusy = true;
		try {
			const { data: checkout, error } = await authClient.subscription.upgrade({
				plan: 'super',
				annual,
				successUrl: `${window.location.origin}${resolve('/app/super/setup')}?checkout=success`,
				cancelUrl: `${window.location.origin}${resolve('/pricing')}`,
				returnUrl: `${window.location.origin}${resolve('/app/super/setup')}`,
				disableRedirect: true
			});
			if (error || !checkout?.url) throw new Error(error?.message ?? 'Could not start checkout.');
			window.location.assign(checkout.url);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not start checkout.');
			billingBusy = false;
			throw error;
		}
	}

	async function manageBilling() {
		if (billingBusy) return;
		billingBusy = true;
		try {
			const { data: portal, error } = await authClient.subscription.billingPortal({
				returnUrl: `${window.location.origin}${resolve('/app/super/setup')}`,
				disableRedirect: true
			});
			if (error || !portal?.url)
				throw new Error(error?.message ?? 'Could not open billing management.');
			window.location.assign(portal.url);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not open billing management.');
			billingBusy = false;
		}
	}

	const primaryLabel = $derived.by(() => {
		if (saving || billingBusy) return 'Saving…';
		if (step === 'age' && !form.ageConfirmed) return 'I am at least 13';
		if (step === 'plan') return isSuperMember ? 'Continue setup' : 'Stay on Free';
		if (step === 'memory' && !isSuperMember && data.checkoutEnabled) return 'Continue to checkout';
		if (isLast) return isSuperMember ? 'Continue to Coach' : 'Finish setup';
		return 'Continue';
	});

	const showFooterContinue = $derived(step !== 'plan' || isSuperMember);
</script>

<svelte:head><title>Set up Super – Free AP Practice</title></svelte:head>

<div class="onboarding-shell min-h-svh px-5 py-8 sm:px-8 sm:py-10">
	<div class="mx-auto w-full max-w-3xl">
		<header
			class="onboarding-enter flex items-center justify-between gap-3"
			style="--onboarding-delay: 0ms"
		>
			<div class="flex items-center gap-2 font-medium tracking-tight">
				<img src={logo} alt="Free AP Practice" class="size-7 rounded-sm" />
				<span>Free AP Practice</span>
			</div>
			<span
				class="rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground"
			>
				Step {Math.max(stepIndex, 0) + 1} of {steps.length}
			</span>
		</header>

		<nav
			class="onboarding-enter mt-8 flex flex-wrap gap-2"
			style="--onboarding-delay: 40ms"
			aria-label="Setup progress"
		>
			{#each steps as entry, index (entry.id)}
				{@const complete = index < stepIndex}
				{@const active = entry.id === step}
				{@const chipClass = complete
					? 'border-primary bg-primary text-primary-foreground'
					: active
						? 'border-primary bg-primary/5 text-foreground'
						: 'border-border text-muted-foreground'}
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors {chipClass}"
					disabled={index > stepIndex}
					onclick={() => {
						if (index <= stepIndex) goTo(entry.id);
					}}
				>
					{#if complete}
						<CheckIcon class="size-3" />
					{:else}
						<span class="tabular-nums">{index + 1}</span>
					{/if}
					<span class="hidden sm:inline">{entry.label}</span>
				</button>
			{/each}
		</nav>

		{#key stepKey}
			<div
				class="mx-auto mt-10 space-y-8 sm:mt-14"
				class:max-w-2xl={step !== 'plan'}
				class:max-w-4xl={step === 'plan'}
			>
				<div class="onboarding-enter space-y-3 text-center" style="--onboarding-delay: 80ms">
					<h1
						class="font-display text-3xl leading-[1.08] font-medium tracking-tight text-balance sm:text-4xl"
					>
						{current.title}
					</h1>
					<p class="mx-auto max-w-xl text-base leading-7 text-muted-foreground">
						{current.description}
					</p>
				</div>

				<div class="onboarding-enter space-y-5" style="--onboarding-delay: 160ms">
					{#if step === 'age'}
						<div
							class="rounded-xl border border-border/70 bg-card/40 px-5 py-6 text-sm leading-6 text-muted-foreground"
						>
							{#if form.ageConfirmed}
								You’re confirmed. Continue to choose Free or Super.
							{:else}
								By continuing, you confirm that you are at least 13 years old and can use
								personalized Super features.
							{/if}
						</div>
					{:else if step === 'plan'}
						<PricingCards>
							{#snippet freeBadge()}
								{#if !isSuperMember}
									<span
										class="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground"
									>
										Current
									</span>
								{/if}
							{/snippet}
							{#snippet freeAction()}
								{#if isSuperMember}
									<Button variant="outline" class="mt-8 w-full" disabled>Not your plan</Button>
								{:else}
									<Button variant="outline" class="mt-8 w-full" href={resolve('/app')}>
										Stay on Free
									</Button>
								{/if}
							{/snippet}
							{#snippet superBadge()}
								{#if isSuperMember}
									<span
										class="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
									>
										Current
									</span>
								{:else}
									<span
										class="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
									>
										Upgrade
									</span>
								{/if}
							{/snippet}
							{#snippet superAction()}
								{#if isSuperMember}
									<div class="mt-8 space-y-2">
										<Button class="w-full" onclick={continueWithSuper}>
											Continue setup <ArrowRightIcon class="size-4" />
										</Button>
										<Button
											variant="outline"
											class="w-full"
											onclick={manageBilling}
											disabled={billingBusy}
										>
											{billingBusy ? 'Opening…' : 'Manage billing'}
										</Button>
									</div>
								{:else if data.checkoutEnabled}
									<div class="mt-6 flex flex-wrap gap-2">
										<Button
											size="sm"
											onclick={() => (annual = false)}
											variant={annual ? 'outline' : 'default'}
										>
											Monthly
										</Button>
										<Button
											size="sm"
											onclick={() => (annual = true)}
											variant={annual ? 'default' : 'outline'}
										>
											Yearly
										</Button>
									</div>
									<Button class="mt-3 w-full" onclick={continueWithSuper}>
										Upgrade to Super <ArrowRightIcon class="size-4" />
									</Button>
								{:else}
									<p class="mt-8 text-sm text-muted-foreground">
										New Super checkout is temporarily unavailable. Existing members keep their
										access.
									</p>
								{/if}
							{/snippet}
						</PricingCards>
					{:else if step === 'style'}
						<fieldset class="space-y-3">
							<legend class="sr-only">Teaching style</legend>
							{#each [{ value: 'socratic' as const, title: 'Socratic hints', detail: 'Guiding questions that help you reason it out.' }, { value: 'concise' as const, title: 'Concise explanations', detail: 'Short, direct answers when you want clarity fast.' }, { value: 'step_by_step' as const, title: 'Step by step', detail: 'Walk through problems in ordered stages.' }] as option (option.value)}
								{@const selected = form.teachingStyle === option.value}
								<label
									class="flex cursor-pointer items-start gap-3 rounded-xl border bg-background px-4 py-3 transition-colors hover:border-primary/50 hover:bg-primary/5 {selected
										? 'border-primary bg-primary/5'
										: 'border-border/70'}"
								>
									<input
										type="radio"
										name="teaching-style"
										value={option.value}
										bind:group={form.teachingStyle}
										class="mt-1"
									/>
									<span>
										<span class="block text-sm font-medium text-foreground">{option.title}</span>
										<span class="mt-1 block text-sm text-muted-foreground">{option.detail}</span>
									</span>
								</label>
							{/each}
						</fieldset>
					{:else if step === 'memory'}
						<div class="space-y-4" id="tutor-memory">
							<div
								class="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-4"
							>
								<div>
									<Label for="super-memory">Personalized memory</Label>
									<p class="mt-1 text-sm text-muted-foreground">
										Store learning preferences and recurring misconceptions, never full chats.
									</p>
								</div>
								<Switch
									id="super-memory"
									checked={form.memoryEnabled}
									onCheckedChange={(checked: boolean) => (form.memoryEnabled = checked)}
								/>
							</div>
							<p class="text-sm leading-6 text-muted-foreground">
								When memory is on, the tutor can retain small learning facts. You can pause use,
								review every saved fact, delete facts one by one, or delete all of them in Settings
								anytime.
							</p>
							{#if !form.disclosureSeen}
								<p
									class="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
								>
									Continuing acknowledges that you understand how tutor memory works.
								</p>
							{/if}

							{#if memoryLoading}
								<p class="text-sm text-muted-foreground">Loading saved memories…</p>
							{:else if memories.length}
								<div class="space-y-2 border-t border-border/60 pt-4">
									<div class="flex items-center justify-between gap-3">
										<p class="text-sm font-medium">Saved facts</p>
										<Button variant="outline" size="sm" onclick={deleteAllMemories}
											>Delete all</Button
										>
									</div>
									{#each memories as memory (memory.id)}
										<div class="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
											<div>
												<p class="text-sm">{memory.text}</p>
												{#if memory.createdAt}
													<p class="mt-1 text-xs text-muted-foreground">
														Saved {new Date(memory.createdAt).toLocaleDateString()}
													</p>
												{/if}
											</div>
											<Button variant="ghost" size="sm" onclick={() => deleteMemory(memory.id)}
												>Delete</Button
											>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<div
					class="onboarding-enter flex flex-col-reverse items-stretch justify-between gap-3 pt-6 sm:flex-row sm:items-center"
					style="--onboarding-delay: 240ms"
				>
					<div class="flex flex-wrap items-center gap-2">
						{#if !isFirst}
							<Button variant="outline" onclick={goBack} disabled={saving || billingBusy}
								><ArrowLeftIcon class="size-4" /> Back</Button
							>
						{/if}
						{#if step !== 'plan'}
							<Button variant="ghost" href={skipHref}>Skip for now</Button>
						{/if}
					</div>
					{#if showFooterContinue}
						<Button size="lg" onclick={advance} disabled={saving || billingBusy}>
							{primaryLabel}
						</Button>
					{/if}
				</div>
			</div>
		{/key}
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
	}

	.onboarding-enter {
		animation: onboarding-rise 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: var(--onboarding-delay, 0ms);
	}

	@media (prefers-reduced-motion: reduce) {
		.onboarding-enter {
			animation: none;
		}
	}
</style>
