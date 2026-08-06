<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { authClient } from '$lib/auth/client.js';
	import { privacy } from '$lib/client/privacy.svelte.js';
	import { settingsController } from '$lib/client/settings.svelte.js';
	import { resetUiHints } from '$lib/client/ui-hints.svelte.js';
	import { resetPostHogUser } from '$lib/client/posthog-analytics';
	import { onboardingSubjectGroups } from '$lib/onboarding-subjects.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { userPrefersMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import LaptopIcon from '@lucide/svelte/icons/laptop';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';

	let { data, form } = $props();

	type SettingsSection =
		'practice' | 'appearance' | 'privacy' | 'super' | 'account' | 'advanced' | 'about';
	type Theme = 'light' | 'dark' | 'system';

	const SECTIONS: { id: SettingsSection; label: string }[] = [
		{ id: 'practice', label: 'Practice' },
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'privacy', label: 'Privacy' },
		{ id: 'super', label: 'Super' },
		{ id: 'account', label: 'Account' },
		{ id: 'advanced', label: 'Advanced' },
		{ id: 'about', label: 'About' }
	];

	const THEME_LABELS: Record<Theme, string> = {
		light: 'Light',
		dark: 'Dark',
		system: 'System'
	};

	let activeSection = $state<SettingsSection>('practice');
	let deleteAccountOpen = $state(false);
	let clearPracticeOpen = $state(false);
	let accountForm = $state({ name: '', email: '' });
	let deletePassword = $state('');
	let signOutPending = $state(false);
	let billingBusy = $state(false);

	const theme = $derived(userPrefersMode.current);
	const themeLabel = $derived(
		theme === 'light' || theme === 'dark' || theme === 'system' ? THEME_LABELS[theme] : 'System'
	);
	const selectedSubjects = $derived(new Set(data.selectedSubjects));

	function subjectId(subject: string): string {
		return `settings-subject-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
	}

	function sectionFromHash(hash: string): SettingsSection {
		if (hash === 'danger') return 'account';
		if (hash === 'tutor-memory') return 'super';
		if (SECTIONS.some((section) => section.id === hash)) {
			return hash as SettingsSection;
		}
		return 'practice';
	}

	function syncHash(section: SettingsSection) {
		history.replaceState(null, '', `#${section}`);
	}

	function handleSectionChange(value: string | undefined) {
		if (!value || !SECTIONS.some((section) => section.id === value)) return;
		activeSection = value as SettingsSection;
		syncHash(activeSection);
	}

	onMount(() => {
		accountForm = { name: data.user.name, email: data.user.email };

		const hash = window.location.hash.slice(1);
		activeSection = sectionFromHash(hash);
		syncHash(activeSection);
	});

	function onThemeChange(value: string) {
		if (value === 'light' || value === 'dark' || value === 'system') {
			settingsController.setTheme(value);
		}
	}

	function handleUpdateAccount(e: SubmitEvent) {
		e.preventDefault();
		settingsController.updateAccount(data.user, accountForm);
	}

	function resetAccountForm() {
		accountForm = { name: data.user.name, email: data.user.email };
	}

	function resetProductHints() {
		resetUiHints();
		toast.success('First-use hints will show again.');
	}

	async function handleDeleteAccount() {
		const result = await settingsController.deleteAccount(deletePassword || undefined);
		if (result) {
			deleteAccountOpen = false;
			deletePassword = '';
		}
	}

	async function handleClearPracticeData() {
		const result = await settingsController.clearPracticeData();
		if (result) {
			clearPracticeOpen = false;
		}
	}

	async function handleSignOut() {
		if (signOutPending) return;
		signOutPending = true;
		try {
			await authClient.signOut({
				fetchOptions: {
					onSuccess: () => {
						resetPostHogUser();
						window.location.href = resolve('/');
					}
				}
			});
		} finally {
			signOutPending = false;
		}
	}

	function formatDate(value: string | null | undefined): string {
		if (!value) return 'Not available';
		const date = new Date(value);
		return Number.isFinite(date.getTime())
			? new Intl.DateTimeFormat(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				}).format(date)
			: 'Not available';
	}

	async function manageBilling() {
		if (billingBusy) return;
		billingBusy = true;
		try {
			const { data: portal, error } = await authClient.subscription.billingPortal({
				returnUrl: `${window.location.origin}${resolve('/app/settings')}`,
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
</script>

<svelte:head>
	<title>Settings – Free AP Practice</title>
</svelte:head>

<PageShell title="Settings" description="Manage your account and preferences.">
	<div class="mx-auto w-full max-w-2xl">
		<Tabs.Root
			bind:value={activeSection}
			onValueChange={handleSectionChange}
			class="flex flex-col gap-6"
		>
			<Tabs.List
				class="h-auto w-full justify-start gap-1 overflow-x-auto"
				aria-label="Settings sections"
			>
				{#each SECTIONS as section (section.id)}
					<Tabs.Trigger value={section.id} class="shrink-0">
						{section.label}
					</Tabs.Trigger>
				{/each}
			</Tabs.List>

			<Tabs.Content value="practice" class="flex flex-col gap-3">
				<div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
					<form method="POST" action="?/updateSubjects" class="space-y-4 px-4 py-4">
						<div class="space-y-0.5">
							<p class="text-sm font-medium text-foreground">Classes</p>
							<p class="text-sm text-muted-foreground">
								Choose the AP classes you want to practice.
							</p>
						</div>
						<div class="space-y-5">
							{#each onboardingSubjectGroups as group (group.label)}
								<section class="space-y-2" aria-labelledby={subjectId(group.label)}>
									<h2 id={subjectId(group.label)} class="text-xs font-medium text-muted-foreground">
										{group.label}
									</h2>
									<div class="grid gap-2 sm:grid-cols-2">
										{#each group.subjects as subject (subject.name)}
											{@const id = subjectId(subject.name)}
											{@const SubjectIcon = subject.icon}
											<div>
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
													class="flex min-h-14 cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm transition-colors peer-checked:border-primary peer-checked:bg-primary/5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:border-primary/50 hover:bg-primary/5 peer-checked:[&_.selection-check]:opacity-100 peer-checked:[&_.subject-icon]:bg-primary peer-checked:[&_.subject-icon]:text-primary-foreground"
												>
													<span
														class="subject-icon flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors"
													>
														<SubjectIcon class="size-4" />
													</span>
													<span class="min-w-0 flex-1 leading-tight font-medium"
														>{subject.name}</span
													>
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
						{#if form?.subjectError}
							<p class="text-sm text-destructive" role="alert">{form.subjectError}</p>
						{/if}
						<div class="flex justify-end">
							<Button type="submit" size="sm">Save classes</Button>
						</div>
					</form>
					<div class="border-t border-border/60"></div>
					<div class="flex items-center justify-between gap-4 px-4 py-3.5">
						<div class="flex min-w-0 flex-col gap-0.5">
							<p class="text-sm font-medium text-foreground">Clear practice data</p>
							<p class="text-sm text-muted-foreground">
								Delete question history, mastery progress, bookmarks, and FRQ submissions. Your
								account stays signed in.
							</p>
						</div>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onclick={() => (clearPracticeOpen = true)}
						>
							Clear
						</Button>
					</div>
				</div>
			</Tabs.Content>

			<Tabs.Content value="appearance" class="flex flex-col gap-3">
				<div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
					<div class="flex items-center justify-between gap-4 px-4 py-3.5">
						<div class="flex min-w-0 flex-col gap-0.5">
							<p class="text-sm font-medium text-foreground">Theme</p>
							<p class="text-sm text-muted-foreground">
								Light, dark, or match your system setting.
							</p>
						</div>
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="outline"
										size="sm"
										class="min-w-28 justify-between gap-2"
									>
										<span class="flex items-center gap-2">
											{#if theme === 'dark'}
												<MoonIcon class="size-3.5" />
											{:else if theme === 'light'}
												<SunIcon class="size-3.5" />
											{:else}
												<LaptopIcon class="size-3.5" />
											{/if}
											{themeLabel}
										</span>
										<ChevronsUpDownIcon class="size-3.5 opacity-60" />
									</Button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" class="min-w-36">
								<DropdownMenu.RadioGroup value={theme} onValueChange={onThemeChange}>
									<DropdownMenu.RadioItem value={'light' satisfies Theme}>
										<SunIcon />
										Light
									</DropdownMenu.RadioItem>
									<DropdownMenu.RadioItem value={'dark' satisfies Theme}>
										<MoonIcon />
										Dark
									</DropdownMenu.RadioItem>
									<DropdownMenu.RadioItem value={'system' satisfies Theme}>
										<LaptopIcon />
										System
									</DropdownMenu.RadioItem>
								</DropdownMenu.RadioGroup>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				</div>
			</Tabs.Content>

			<Tabs.Content value="privacy" class="flex flex-col gap-3">
				<div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
					<div class="flex items-center justify-between gap-4 px-4 py-3.5">
						<div class="flex min-w-0 flex-col gap-0.5">
							<p class="text-sm font-medium text-foreground">Analytics</p>
							<p class="text-sm text-muted-foreground">
								Allow PostHog to collect feature usage, errors, and session replay. Vercel Analytics
								always runs cookieless for aggregate traffic.
							</p>
						</div>
						<Switch
							id="analytics-toggle"
							name="analytics"
							checked={privacy.analyticsConsent === 'granted'}
							onCheckedChange={(checked: boolean) =>
								privacy.setAnalyticsConsent(checked ? 'granted' : 'denied')}
						/>
					</div>
				</div>
			</Tabs.Content>

			<Tabs.Content value="super" class="flex flex-col gap-3">
				<div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
					<div class="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
						<div class="min-w-0 space-y-0.5">
							<p class="text-sm font-medium text-foreground">
								{data.entitlements.plan === 'super' ? 'Super plan' : 'Free plan'}
							</p>
							<p class="text-sm text-muted-foreground">
								{#if data.entitlements.plan === 'super'}
									{#if data.freeBetaEnabled}
										Super access is free during the beta for every account.
									{:else if data.entitlements.accessReason === 'admin_grant'}
										Super access granted by the team.
									{:else if data.billing?.status === 'past_due'}
										Payment is past due; Super access remains available during the grace period.
									{:else}
										Personalized tutoring, Coach, insights, and study plans are active.
									{/if}
								{:else}
									Upgrade when you want personalized tutoring and study planning.
								{/if}
							</p>
						</div>
						{#if data.entitlements.plan === 'super' && data.billing?.hasCustomer}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={manageBilling}
								disabled={billingBusy}
							>
								{billingBusy ? 'Opening…' : 'Customer Portal'}
							</Button>
						{:else if data.entitlements.plan !== 'super'}
							<Button type="button" variant="outline" size="sm" href={resolve('/pricing')}
								>Upgrade</Button
							>
						{/if}
					</div>

					{#if data.entitlements.plan === 'super'}
						<div class="space-y-3 border-t border-border/60 px-4 py-4">
							<div class="grid gap-3 sm:grid-cols-2">
								<div>
									<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
										Status
									</p>
									<p class="mt-1 text-sm font-medium capitalize">
										{data.billing?.status?.replaceAll('_', ' ') ?? 'Active'}
									</p>
								</div>
								<div>
									<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
										{data.billing?.cancelAt || data.billing?.cancelAtPeriodEnd
											? 'Cancels'
											: 'Renews'}
									</p>
									<p class="mt-1 text-sm font-medium">
										{formatDate(data.billing?.cancelAt ?? data.billing?.periodEnd)}
									</p>
								</div>
							</div>
							<div>
								<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
									Personalized AI usage
								</p>
								{#if data.usage.status === 'available'}
									<p class="mt-1 text-sm">
										{data.usage.remaining} of {data.usage.limit} messages remaining this month.
									</p>
									{#if data.usage.warning}
										<p class="mt-1 text-sm text-amber-700 dark:text-amber-300">
											You have used {data.usage.warning}% of this month's personalized messages.
										</p>
									{/if}
								{:else}
									<p class="mt-1 text-sm text-muted-foreground">
										Usage is unavailable right now. Try again later.
									</p>
								{/if}
							</div>
						</div>
					{/if}

					<div
						class="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 px-4 py-4"
					>
						<div class="min-w-0 space-y-0.5">
							<p class="text-sm font-medium text-foreground">Tutor memory</p>
							<p class="text-sm text-muted-foreground">
								Memory is {data.profile.memoryEnabled ? 'on' : 'paused'}. Review, delete, or update
								your memory preferences.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							href={`${resolve('/app/super/setup')}#tutor-memory`}>Manage memory</Button
						>
					</div>
				</div>
			</Tabs.Content>

			<Tabs.Content value="advanced" class="flex flex-col gap-3">
				<div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
					<div class="flex items-center justify-between gap-4 px-4 py-3.5">
						<div class="flex min-w-0 flex-col gap-0.5">
							<p class="text-sm font-medium text-foreground">Reset onboarding</p>
							<p class="text-sm text-muted-foreground">
								Show the subject selection screen again so you can test the onboarding flow.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							href={resolve('/app/onboarding?reset=1')}
						>
							Reset
						</Button>
					</div>
					<div
						class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5"
					>
						<div class="min-w-0 flex-1 space-y-0.5">
							<p class="text-sm font-medium text-foreground">Reset first-use hints</p>
							<p class="text-sm text-muted-foreground">
								Show the small tips for the dashboard, practice selector, question tools, and Tutor
								again.
							</p>
						</div>
						<Button type="button" variant="outline" size="sm" onclick={resetProductHints}>
							Reset
						</Button>
					</div>
				</div>
			</Tabs.Content>

			<Tabs.Content value="account" class="flex flex-col gap-3">
				<div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
					<form onsubmit={handleUpdateAccount} class="flex flex-col gap-4 px-4 py-4">
						<div class="flex flex-col gap-2">
							<Label for="name">Name</Label>
							<Input id="name" class="ph-mask-pii" bind:value={accountForm.name} />
						</div>
						<div class="flex flex-col gap-2">
							<Label for="email">Email</Label>
							<Input id="email" type="email" class="ph-mask-pii" bind:value={accountForm.email} />
						</div>
						<div class="flex flex-wrap gap-2 pt-1">
							<Button type="submit" size="sm" disabled={settingsController.accountPending}>
								{settingsController.accountPending ? 'Saving...' : 'Save changes'}
							</Button>
							<Button type="button" variant="outline" size="sm" onclick={resetAccountForm}>
								Reset
							</Button>
						</div>
					</form>
					<div
						class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5"
					>
						<div class="flex min-w-0 flex-col gap-0.5">
							<p class="text-sm font-medium text-foreground">Sign out</p>
							<p class="text-sm text-muted-foreground">End your session on this device.</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={handleSignOut}
							disabled={signOutPending}
						>
							{signOutPending ? 'Signing out...' : 'Sign out'}
						</Button>
					</div>
					<div
						class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5"
					>
						<div class="flex min-w-0 flex-col gap-0.5">
							<p class="text-sm font-medium text-destructive">Delete account</p>
							<p class="text-sm text-muted-foreground">
								Permanently delete your account and all associated data.
							</p>
						</div>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onclick={() => (deleteAccountOpen = true)}
						>
							Delete
						</Button>
					</div>
				</div>
			</Tabs.Content>

			<Tabs.Content value="about" class="flex flex-col gap-3">
				<div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
					<div class="flex items-center justify-between gap-4 px-4 py-3.5">
						<div class="flex min-w-0 flex-col gap-0.5">
							<p class="text-sm font-medium text-foreground">App version</p>
							<p class="text-sm text-muted-foreground">Current Free AP Practice release.</p>
						</div>
						<p class="text-sm font-medium text-foreground tabular-nums">1.5.5</p>
					</div>
					<div
						class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5"
					>
						<div class="flex min-w-0 flex-col gap-0.5">
							<p class="text-sm font-medium text-foreground">Privacy Policy</p>
							<p class="text-sm text-muted-foreground">How we handle your data.</p>
						</div>
						<Button type="button" variant="outline" size="sm" href={resolve('/privacy')}
							>View</Button
						>
					</div>
					<div
						class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5"
					>
						<div class="flex min-w-0 flex-col gap-0.5">
							<p class="text-sm font-medium text-foreground">Terms of Service</p>
							<p class="text-sm text-muted-foreground">The rules for using this site.</p>
						</div>
						<Button type="button" variant="outline" size="sm" href={resolve('/terms')}>View</Button>
					</div>
					<div
						class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5"
					>
						<div class="flex min-w-0 flex-col gap-0.5">
							<p class="text-sm font-medium text-foreground">Changelog</p>
							<p class="text-sm text-muted-foreground">What changed in recent releases.</p>
						</div>
						<Button type="button" variant="outline" size="sm" href={resolve('/changelog')}>
							View
						</Button>
					</div>
				</div>
			</Tabs.Content>
		</Tabs.Root>
	</div>
</PageShell>

<AlertDialog.Root bind:open={clearPracticeOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Clear practice data?</AlertDialog.Title>
			<AlertDialog.Description>
				This permanently deletes your question history, mastery progress, bookmarks, and FRQ
				submissions. Your account will stay active. This cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
				onclick={handleClearPracticeData}
				disabled={settingsController.clearPracticePending}
			>
				{settingsController.clearPracticePending ? 'Clearing...' : 'Clear practice data'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={deleteAccountOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete your account?</AlertDialog.Title>
			<AlertDialog.Description>
				We'll email you a confirmation link to permanently delete your account and data. This cannot
				be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<div class="px-6 pb-2">
			<Label for="delete-password">Password (email/password accounts)</Label>
			<Input
				id="delete-password"
				type="password"
				autocomplete="current-password"
				placeholder="Optional if you signed in with Google"
				bind:value={deletePassword}
				class="mt-2"
			/>
		</div>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
				onclick={handleDeleteAccount}
				disabled={settingsController.deletePending}
			>
				{settingsController.deletePending ? 'Sending...' : 'Send deletion email'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
