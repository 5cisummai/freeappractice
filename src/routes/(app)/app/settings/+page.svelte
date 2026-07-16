<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { authClient } from '$lib/auth/client.js';
	import { privacy } from '$lib/client/privacy.svelte.js';
	import { realisticMode } from '$lib/client/realistic-mode.svelte.js';
	import { settingsController } from '$lib/client/settings.svelte.js';
	import { userPrefersMode } from 'mode-watcher';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import LaptopIcon from '@lucide/svelte/icons/laptop';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';

	let { data } = $props();

	type SettingsSection = 'practice' | 'appearance' | 'privacy' | 'account' | 'about';
	type Theme = 'light' | 'dark' | 'system';

	const SECTIONS: { id: SettingsSection; label: string }[] = [
		{ id: 'practice', label: 'Practice' },
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'privacy', label: 'Privacy' },
		{ id: 'account', label: 'Account' },
		{ id: 'about', label: 'About' }
	];

	const THEME_LABELS: Record<Theme, string> = {
		light: 'Light',
		dark: 'Dark',
		system: 'System'
	};

	let activeSection = $state<SettingsSection>('practice');
	let scrollingToSection = $state(false);
	let deleteAccountOpen = $state(false);
	let accountForm = $state({ name: '', email: '' });
	let deletePassword = $state('');
	let signOutPending = $state(false);

	const theme = $derived(userPrefersMode.current);
	const themeLabel = $derived(
		theme === 'light' || theme === 'dark' || theme === 'system' ? THEME_LABELS[theme] : 'System'
	);

	onMount(() => {
		accountForm = { name: data.user.name, email: data.user.email };

		const hash = window.location.hash.slice(1) as SettingsSection;
		if (SECTIONS.some((section) => section.id === hash)) {
			activeSection = hash;
			document.getElementById(hash)?.scrollIntoView({ behavior: 'auto', block: 'start' });
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (scrollingToSection) return;
				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
				const top = visible[0]?.target.id as SettingsSection | undefined;
				if (top && SECTIONS.some((section) => section.id === top)) {
					activeSection = top;
				}
			},
			{ rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] }
		);

		for (const section of SECTIONS) {
			const el = document.getElementById(section.id);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	});

	function scrollToSection(id: SettingsSection) {
		activeSection = id;
		scrollingToSection = true;
		history.replaceState(null, '', `#${id}`);
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		window.setTimeout(() => {
			scrollingToSection = false;
		}, 700);
	}

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

	async function handleSignOut() {
		if (signOutPending) return;
		signOutPending = true;
		try {
			await authClient.signOut({
				fetchOptions: {
					onSuccess: () => {
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

<PageShell title="Settings" description="Manage your account and app preferences.">
	<div class="mx-auto w-full max-w-2xl space-y-8">
		<nav
			class="sticky top-14 z-10 -mx-1 flex gap-1 overflow-x-auto bg-background/95 px-1 py-2 backdrop-blur supports-backdrop-filter:bg-background/80"
			aria-label="Settings sections"
		>
			{#each SECTIONS as section (section.id)}
				<button
					type="button"
					class={[
						'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
						activeSection === section.id
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'
					]}
					aria-current={activeSection === section.id ? 'true' : undefined}
					onclick={() => scrollToSection(section.id)}
				>
					{section.label}
				</button>
			{/each}
		</nav>

		<section id="practice" class="scroll-mt-28 space-y-3">
			<h2 class="text-sm font-medium text-muted-foreground">Practice</h2>
			<div class="overflow-hidden rounded-xl border border-border/60 bg-muted/30">
				<div class="flex items-center justify-between gap-4 px-4 py-3.5">
					<div class="min-w-0 space-y-0.5">
						<p class="text-sm font-medium text-foreground">Realistic exam mode</p>
						<p class="text-sm text-muted-foreground">
							Strip practice chrome so questions look closer to the real AP exam.
						</p>
					</div>
					<Switch
						id="realistic-mode"
						checked={realisticMode.enabled}
						onCheckedChange={(checked: boolean) => realisticMode.setEnabled(checked)}
					/>
				</div>
			</div>
		</section>

		<section id="appearance" class="scroll-mt-28 space-y-3">
			<h2 class="text-sm font-medium text-muted-foreground">Appearance</h2>
			<div class="overflow-hidden rounded-xl border border-border/60 bg-muted/30">
				<div class="flex items-center justify-between gap-4 px-4 py-3.5">
					<div class="min-w-0 space-y-0.5">
						<p class="text-sm font-medium text-foreground">Theme</p>
						<p class="text-sm text-muted-foreground">Light, dark, or match your system setting.</p>
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
		</section>

		<section id="privacy" class="scroll-mt-28 space-y-3">
			<h2 class="text-sm font-medium text-muted-foreground">Privacy</h2>
			<div class="overflow-hidden rounded-xl border border-border/60 bg-muted/30">
				<div class="flex items-center justify-between gap-4 px-4 py-3.5">
					<div class="min-w-0 space-y-0.5">
						<p class="text-sm font-medium text-foreground">Product analytics</p>
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
		</section>

		<section id="account" class="scroll-mt-28 space-y-3">
			<h2 class="text-sm font-medium text-muted-foreground">Account</h2>
			<div class="overflow-hidden rounded-xl border border-border/60 bg-muted/30">
				<form onsubmit={handleUpdateAccount} class="space-y-4 px-4 py-4">
					<div class="space-y-2">
						<Label for="name">Name</Label>
						<Input id="name" class="ph-mask-pii" bind:value={accountForm.name} />
					</div>
					<div class="space-y-2">
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
				<div class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5">
					<div class="min-w-0 space-y-0.5">
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
				<div class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5">
					<div class="min-w-0 space-y-0.5">
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
		</section>

		<section id="about" class="scroll-mt-28 space-y-3">
			<h2 class="text-sm font-medium text-muted-foreground">About</h2>
			<div class="overflow-hidden rounded-xl border border-border/60 bg-muted/30">
				<div class="flex items-center justify-between gap-4 px-4 py-3.5">
					<div class="min-w-0 space-y-0.5">
						<p class="text-sm font-medium text-foreground">App version</p>
						<p class="text-sm text-muted-foreground">Current Free AP Practice release.</p>
					</div>
					<p class="text-sm font-medium text-foreground tabular-nums">1.4.7</p>
				</div>
				<div class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5">
					<div class="min-w-0 space-y-0.5">
						<p class="text-sm font-medium text-foreground">Privacy Policy</p>
						<p class="text-sm text-muted-foreground">How we handle your data.</p>
					</div>
					<Button type="button" variant="outline" size="sm" href={resolve('/privacy')}>View</Button>
				</div>
				<div class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5">
					<div class="min-w-0 space-y-0.5">
						<p class="text-sm font-medium text-foreground">Terms of Service</p>
						<p class="text-sm text-muted-foreground">The rules for using this site.</p>
					</div>
					<Button type="button" variant="outline" size="sm" href={resolve('/terms')}>View</Button>
				</div>
				<div class="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3.5">
					<div class="min-w-0 space-y-0.5">
						<p class="text-sm font-medium text-foreground">Changelog</p>
						<p class="text-sm text-muted-foreground">What changed in recent releases.</p>
					</div>
					<Button type="button" variant="outline" size="sm" href={resolve('/changelog')}>
						View
					</Button>
				</div>
			</div>
		</section>
	</div>
</PageShell>

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
