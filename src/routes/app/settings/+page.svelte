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
	import { resetPostHogUser } from '$lib/client/posthog-analytics';
	import { userPrefersMode } from 'mode-watcher';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import LaptopIcon from '@lucide/svelte/icons/laptop';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';

	let { data } = $props();

	type SettingsSection = 'practice' | 'appearance' | 'privacy' | 'account' | 'advanced' | 'about';
	type Theme = 'light' | 'dark' | 'system';

	const SECTIONS: { id: SettingsSection; label: string }[] = [
		{ id: 'practice', label: 'Practice' },
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'privacy', label: 'Privacy' },
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

	const theme = $derived(userPrefersMode.current);
	const themeLabel = $derived(
		theme === 'light' || theme === 'dark' || theme === 'system' ? THEME_LABELS[theme] : 'System'
	);

	function sectionFromHash(hash: string): SettingsSection {
		if (hash === 'danger') return 'account';
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
							variant="outline"
							size="sm"
							class="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
						<p class="text-sm font-medium text-foreground tabular-nums">1.5.3</p>
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
