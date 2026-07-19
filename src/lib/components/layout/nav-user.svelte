<script lang="ts">
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth/client.js';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SettingsIcon from '@lucide/svelte/icons/settings';

	let {
		user
	}: {
		user: { name: string; email: string; image?: string | null };
	} = $props();

	const sidebar = Sidebar.useSidebar();

	const initials = $derived(
		user.name
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('') || user.email.slice(0, 2).toUpperCase()
	);

	let signOutPending = $state(false);

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

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						{...props}
					>
						<Avatar.Root class="ph-no-capture size-8 rounded-lg">
							{#if user.image}
								<Avatar.Image src={user.image} alt={user.name} />
							{/if}
							<Avatar.Fallback class="ph-mask-pii rounded-lg">{initials}</Avatar.Fallback>
						</Avatar.Root>
						<div class="ph-mask-pii grid flex-1 text-start text-sm leading-tight">
							<span class="truncate font-medium">{user.name}</span>
							<span class="truncate text-xs">{user.email}</span>
						</div>
						<ChevronsUpDownIcon class="ms-auto size-4" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
				side={sidebar.isMobile ? 'bottom' : 'right'}
				align="end"
				sideOffset={4}
			>
				<DropdownMenu.Group>
					<DropdownMenu.Label class="p-0 font-normal">
						<div class="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
							<Avatar.Root class="ph-no-capture size-8 rounded-lg">
								{#if user.image}
									<Avatar.Image src={user.image} alt={user.name} />
								{/if}
								<Avatar.Fallback class="ph-mask-pii rounded-lg">{initials}</Avatar.Fallback>
							</Avatar.Root>
							<div class="ph-mask-pii grid flex-1 text-start text-sm leading-tight">
								<span class="truncate font-medium">{user.name}</span>
								<span class="truncate text-xs">{user.email}</span>
							</div>
						</div>
					</DropdownMenu.Label>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a href={resolve('/app/settings')} {...props}>
								<SettingsIcon />
								Settings
							</a>
						{/snippet}
					</DropdownMenu.Item>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item
						variant="destructive"
						onclick={handleSignOut}
						disabled={signOutPending}
					>
						<LogOutIcon />
						Sign out
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
