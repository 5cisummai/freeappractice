<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { settingsController } from '$lib/client/settings.svelte.js';
	import { auth } from '$lib/client/auth.svelte.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import LaptopIcon from '@lucide/svelte/icons/laptop';
	import UserIcon from '@lucide/svelte/icons/user';
	import PaintbrushIcon from '@lucide/svelte/icons/paintbrush';
	import AccessibilityIcon from '@lucide/svelte/icons/accessibility';
	import InfoIcon from '@lucide/svelte/icons/info';

	type SettingsTab = 'appearance' | 'accessibility' | 'account' | 'about';

	let activeTab = $state<SettingsTab>('appearance');
	let deleteAccountOpen = $state(false);
	let accountForm = $state({
		name: auth.user?.name || '',
		email: auth.user?.email || ''
	});
	const appVersion = '1.3.4';

	function handleUpdateAccount(e: SubmitEvent) {
		e.preventDefault();
		settingsController.updateAccount(accountForm);
	}

	async function handleDeleteAccount() {
		const deleted = await settingsController.deleteAccount();
		if (deleted) {
			deleteAccountOpen = false;
		}
	}
</script>

<Toaster />

<div class="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-8 lg:px-10">
	<div class="space-y-1">
		<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
		<p class="text-sm text-muted-foreground">Manage your account and app preferences.</p>
	</div>

	<Tabs.Root bind:value={activeTab} class="mx-auto w-full max-w-2xl space-y-6">
		<Tabs.List class="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
			<Tabs.Trigger value="appearance" class="flex items-center gap-2">
				<PaintbrushIcon class="h-4 w-4" />
				Appearance
			</Tabs.Trigger>
			<Tabs.Trigger value="accessibility" class="flex items-center gap-2">
				<AccessibilityIcon class="h-4 w-4" />
				Accessibility
			</Tabs.Trigger>
			<Tabs.Trigger value="account" class="flex items-center gap-2">
				<UserIcon class="h-4 w-4" />
				Account
			</Tabs.Trigger>
			<Tabs.Trigger value="about" class="flex items-center gap-2">
				<InfoIcon class="h-4 w-4" />
				About
			</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="appearance">
			<Card.Root>
				<Card.Header>
					<Card.Title>Appearance</Card.Title>
					<Card.Description>Choose your preferred theme and font size.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-6">
					<div class="space-y-4">
						<Label>Theme</Label>
						<div class="grid grid-cols-3 gap-4">
							<Button
								variant={settingsController.settings.theme === 'light' ? 'default' : 'outline'}
								class="flex h-auto flex-col gap-2 py-4"
								onclick={() => settingsController.setTheme('light')}
							>
								<SunIcon class="h-6 w-6" />
								<span>Light</span>
							</Button>
							<Button
								variant={settingsController.settings.theme === 'dark' ? 'default' : 'outline'}
								class="flex h-auto flex-col gap-2 py-4"
								onclick={() => settingsController.setTheme('dark')}
							>
								<MoonIcon class="h-6 w-6" />
								<span>Dark</span>
							</Button>
							<Button
								variant={settingsController.settings.theme === 'system' ? 'default' : 'outline'}
								class="flex h-auto flex-col gap-2 py-4"
								onclick={() => settingsController.setTheme('system')}
							>
								<LaptopIcon class="h-6 w-6" />
								<span>System</span>
							</Button>
						</div>
					</div>

					<div class="space-y-4 border-t border-border pt-4">
						<div class="flex items-center justify-between">
							<Label>Font Size ({settingsController.settings.fontSize}px)</Label>
							<Button variant="ghost" size="sm" onclick={() => settingsController.setFontSize(16)}
								>Reset</Button
							>
						</div>
						<Slider
							type="single"
							value={settingsController.settings.fontSize}
							min={12}
							max={24}
							step={1}
							onValueChange={(value: number) => settingsController.setFontSize(value)}
						/>
						<p class="text-sm text-muted-foreground">Adjust text size for better readability.</p>
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="accessibility">
			<Card.Root>
				<Card.Header>
					<Card.Title>Accessibility</Card.Title>
					<Card.Description>Enable features that make the app easier to use.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-6">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<Label>High Contrast</Label>
							<p class="text-sm text-muted-foreground">Increases visibility of elements.</p>
						</div>
						<Switch
							checked={settingsController.settings.highContrast}
							onCheckedChange={() => settingsController.toggleAccessibility('highContrast')}
						/>
					</div>

					<div class="flex items-center justify-between border-t border-border pt-4">
						<div class="space-y-0.5">
							<Label>Reduce Motion</Label>
							<p class="text-sm text-muted-foreground">Disables UI animations.</p>
						</div>
						<Switch
							checked={settingsController.settings.reduceMotion}
							onCheckedChange={() => settingsController.toggleAccessibility('reduceMotion')}
						/>
					</div>

					<div class="flex items-center justify-between border-t border-border pt-4">
						<div class="space-y-0.5">
							<Label>Dyslexic Friendly Font</Label>
							<p class="text-sm text-muted-foreground">Uses fonts optimized for readability.</p>
						</div>
						<Switch
							checked={settingsController.settings.dyslexicFont}
							onCheckedChange={() => settingsController.toggleAccessibility('dyslexicFont')}
						/>
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="account">
			<Card.Root>
				<Card.Header>
					<Card.Title>Account Settings</Card.Title>
					<Card.Description>Update your profile information.</Card.Description>
				</Card.Header>
				<Card.Content>
					<form onsubmit={handleUpdateAccount} class="space-y-4">
						<div class="space-y-2">
							<Label for="name">Name</Label>
							<Input id="name" bind:value={accountForm.name} />
						</div>
						<div class="space-y-2">
							<Label for="email">Email</Label>
							<Input id="email" type="email" bind:value={accountForm.email} />
						</div>
						<div class="flex gap-4 pt-4">
							<Button type="submit">Save Changes</Button>
							<Button variant="outline" type="button">Reset</Button>
						</div>
					</form>
				</Card.Content>
				<Card.Footer class="flex flex-col items-start gap-4 border-t border-border pt-6">
					<div class="space-y-1">
						<p class="font-semibold text-destructive">Danger Zone</p>
						<p class="text-sm text-muted-foreground">Permanently delete your account and data.</p>
					</div>
					<Button variant="destructive" onclick={() => (deleteAccountOpen = true)}>
						Delete Account
					</Button>
				</Card.Footer>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="about">
			<Card.Root>
				<Card.Header>
					<Card.Title>About</Card.Title>
					<Card.Description>Version details and policy links for Free AP Practice.</Card.Description
					>
				</Card.Header>
				<Card.Content class="space-y-6">
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="rounded-lg border border-border bg-muted/30 p-4">
							<p class="text-xs tracking-wide text-muted-foreground uppercase">App version</p>
							<p class="mt-1 text-lg font-semibold">{appVersion}</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Current release installed in this workspace.
							</p>
						</div>
						<div class="rounded-lg border border-border bg-muted/30 p-4">
							<p class="text-xs tracking-wide text-muted-foreground uppercase">Build</p>
							<p class="mt-1 text-lg font-semibold">SvelteKit</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Versioned app experience for AP practice.
							</p>
						</div>
					</div>

					<div class="space-y-3 border-t border-border pt-4">
						<p class="text-sm font-medium text-foreground">Policies</p>
						<div class="flex flex-wrap gap-3">
							<Button variant="outline" href={resolve('/privacy')}>Privacy Policy</Button>
							<Button variant="outline" href={resolve('/terms')}>Terms of Service</Button>
							<Button variant="ghost" href={resolve('/changelog')}>Changelog</Button>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>

	<AlertDialog.Root bind:open={deleteAccountOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Delete your account?</AlertDialog.Title>
				<AlertDialog.Description>
					This will permanently delete your account and all associated data. This action cannot be
					undone.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action
					class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
					onclick={handleDeleteAccount}
				>
					Delete Account
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</div>
