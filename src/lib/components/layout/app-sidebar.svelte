<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.png';
	import NavMain from '$lib/components/layout/nav-main.svelte';
	import NavUser from '$lib/components/layout/nav-user.svelte';
	import OrgSwitcher from '$lib/components/layout/org-switcher.svelte';
	import FeedbackDialog from '$lib/components/layout/feedback-dialog.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	import CompassIcon from '@tabler/icons-svelte/icons/compass-filled';
	import SettingsIcon from '@tabler/icons-svelte/icons/settings-filled';
	import type { UserOrganization } from '$lib/auth/organization-types';

	let {
		isAdmin,
		user,
		assistantFeaturesEnabled = true,
		organizations = [],
		activeOrganization = null,
		ownedGroupCount = 0
	}: {
		isAdmin: boolean;
		user: { name: string; email: string; image?: string | null };
		assistantFeaturesEnabled?: boolean;
		organizations?: UserOrganization[];
		activeOrganization?: UserOrganization | null;
		ownedGroupCount?: number;
	} = $props();

	const showMembers = $derived(activeOrganization?.orgType === 'group');

	function isActive(href: '/app/settings' | '/app/resources'): boolean {
		const resolved = resolve(href);
		return page.url.pathname === resolved || page.url.pathname.startsWith(resolved + '/');
	}
</script>

<Sidebar.Root collapsible="offcanvas" variant="inset">
	<Sidebar.Header class="justify-center gap-1">
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
		<OrgSwitcher {organizations} {activeOrganization} {ownedGroupCount} />
	</Sidebar.Header>

	<Sidebar.Content>
		<NavMain {assistantFeaturesEnabled} {showMembers} {isAdmin} />
	</Sidebar.Content>

	<Sidebar.Footer class="border-t border-sidebar-border">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					isActive={isActive('/app/settings')}
					tooltipContent="Settings"
					class="data-active:bg-primary/10 data-active:font-medium data-active:text-primary"
				>
					{#snippet child({ props })}
						<a
							href={resolve('/app/settings')}
							aria-current={isActive('/app/settings') ? 'page' : undefined}
							{...props}
						>
							<SettingsIcon />
							<span>Settings</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
			<FeedbackDialog />
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					isActive={isActive('/app/resources')}
					tooltipContent="Resources"
					class="data-active:bg-primary/10 data-active:font-medium data-active:text-primary"
				>
					{#snippet child({ props })}
						<a
							href={resolve('/app/resources')}
							aria-current={isActive('/app/resources') ? 'page' : undefined}
							{...props}
						>
							<CompassIcon />
							<span>Resources</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
		<NavUser {user} />
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
