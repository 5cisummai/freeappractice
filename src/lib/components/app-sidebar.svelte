<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/client/auth.svelte.js';
	import { toggleMode } from 'mode-watcher';
	import logo from '$lib/assets/logo.png';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CompassIcon from '@lucide/svelte/icons/compass';
	import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';

	const navItems = [
		{ href: '/app', label: 'Dashboard', icon: LayoutDashboardIcon },
		{ href: '/app/practice', label: 'Practice', icon: BookOpenIcon },
		{ href: '/app/progress', label: 'Progress', icon: BarChart3Icon },
		{ href: '/app/resources', label: 'Resources', icon: CompassIcon },
		{ href: '/app/settings', label: 'Settings', icon: SettingsIcon }
	];

	function isActive(href: string): boolean {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return page.url.pathname === resolve(href as any);
	}

	async function handleSignOut() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
		} finally {
			auth.clearAuth();
			goto(resolve('/'));
		}
	}
</script>

<Sidebar.Root collapsible="icon">
	<Sidebar.Header class="h-14 justify-center">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg" tooltipContent="Free AP Practice">
					{#snippet child({ props })}
						<a href={resolve('/app')} {...props}>
							<img src={logo} alt="Logo" class="size-7 rounded-sm" />
							<span class="font-semibold tracking-tight">Free AP Practice</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each navItems as item (item.href)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={isActive(item.href)} tooltipContent={item.label}>
								{#snippet child({ props })}
									<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
									<a
										href={resolve(item.href as any)}
										aria-current={isActive(item.href) ? 'page' : undefined}
										{...props}
									>
										<item.icon />
										<span>{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="border-t border-sidebar-border">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton tooltipContent="Toggle theme" onclick={toggleMode}>
					<span class="relative size-4">
						<SunIcon
							class="absolute inset-0 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
						/>
						<MoonIcon
							class="absolute inset-0 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
						/>
					</span>
					<span>Toggle theme</span>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					tooltipContent="Sign out"
					onclick={handleSignOut}
					class="hover:bg-destructive/10 hover:text-destructive"
				>
					<LogOutIcon />
					<span>Sign out</span>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
