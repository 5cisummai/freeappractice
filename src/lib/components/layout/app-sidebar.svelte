<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import NavMain from '$lib/components/layout/nav-main.svelte';
	import NavUser from '$lib/components/layout/nav-user.svelte';
	import OrgSwitcher from '$lib/components/layout/org-switcher.svelte';
	import FeedbackDialog from '$lib/components/layout/feedback-dialog.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	import SettingsIcon from '@tabler/icons-svelte/icons/settings-filled';
	import UsersGroupIcon from '@tabler/icons-svelte/icons/users-group';
	import ExternalLinkIcon from '@tabler/icons-svelte/icons/external-link-filled';
	import type { UserOrganization } from '$lib/auth/organization-types';

	const COMMUNITY_DISCORD_URL = 'https://discord.gg/6PpCq8P57';

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

	function isSettingsActive(): boolean {
		const resolved = resolve('/app/settings');
		return page.url.pathname === resolved || page.url.pathname.startsWith(`${resolved}/`);
	}
</script>

<Sidebar.Root collapsible="offcanvas" variant="inset">
	<Sidebar.Header class="justify-center gap-1">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg" tooltipContent="Free AP Practice">
					{#snippet child({ props })}
						<a href={resolve('/app')} {...props}>
							<img src="/logo.png" alt="Logo" class="size-7 rounded-sm" />
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
					isActive={isSettingsActive()}
					tooltipContent="Settings"
					class="data-active:bg-primary/10 data-active:font-medium data-active:text-primary"
				>
					{#snippet child({ props })}
						<a
							href={resolve('/app/settings')}
							aria-current={isSettingsActive() ? 'page' : undefined}
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
				<Sidebar.MenuButton tooltipContent="Community">
					{#snippet child({ props })}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a
							href={COMMUNITY_DISCORD_URL}
							target="_blank"
							rel="noopener noreferrer"
							{...props}
						>
							<UsersGroupIcon />
							<span>Community</span>
							<ExternalLinkIcon class="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
		<NavUser {user} />
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
