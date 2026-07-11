<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.png';
	import NavUser from '$lib/components/nav-user.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CompassIcon from '@lucide/svelte/icons/compass';
	import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import ReferralCard from '$lib/components/referral-card.svelte';

	let {
		isAdmin,
		user,
		referral
	}: {
		isAdmin: boolean;
		user: { name: string; email: string; image?: string | null };
		referral: { shareUrl: string; studentsHelped: number; pendingInvites: number };
	} = $props();

	const baseNavItems = [
		{ href: '/app', label: 'Dashboard', icon: LayoutDashboardIcon },
		{ href: '/app/practice', label: 'Practice', icon: BookOpenIcon },
		{ href: '/app/progress', label: 'Progress', icon: BarChart3Icon },
		{ href: '/app/resources', label: 'Resources', icon: CompassIcon },
		{ href: '/app/settings', label: 'Settings', icon: SettingsIcon }
	] as const;

	const adminNavItem = { href: '/app/admin', label: 'Admin', icon: ShieldIcon } as const;
	const navItems = $derived(isAdmin ? [...baseNavItems, adminNavItem] : baseNavItems);

	function isActive(href: (typeof navItems)[number]['href']): boolean {
		return page.url.pathname === resolve(href);
	}
</script>

<Sidebar.Root collapsible="offcanvas" variant="inset">
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
									<a
										href={resolve(item.href)}
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

		<Sidebar.Group class="px-2">
			<ReferralCard
				variant="sidebar"
				shareUrl={referral.shareUrl}
				studentsHelped={referral.studentsHelped}
				pendingInvites={referral.pendingInvites}
			/>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="border-t border-sidebar-border">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<ThemeToggle variant="sidebar" />
			</Sidebar.MenuItem>
		</Sidebar.Menu>
		<NavUser {user} />
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
