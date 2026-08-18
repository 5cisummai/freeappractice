<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getSubjectPresentation } from '$lib/onboarding-subjects.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import EllipsisVerticalIcon from '@tabler/icons-svelte/icons/dots-vertical';
	import { toast } from 'svelte-sonner';

	const materialsImage = '/illustrations/books.png';

	let { data } = $props();

	const organization = $derived(data.activeOrganization);
	const canManage = $derived(data.canManageMaterials);
	let removingId = $state<string | null>(null);
	let removeOpen = $state(false);
	let targetMaterial = $state<(typeof data.materials)[number] | null>(null);

	function practiceHref(slug: string): string {
		return `${resolve('/app/practice')}?shared=${encodeURIComponent(slug)}`;
	}

	function openRemove(material: (typeof data.materials)[number]) {
		targetMaterial = material;
		removeOpen = true;
	}

	async function confirmRemove() {
		const material = targetMaterial;
		if (!organization || !material || removingId) return;
		removingId = material.id;
		removeOpen = false;
		try {
			const response = await apiFetch(
				`/api/shared-practice-sets/${material.id}?organizationId=${encodeURIComponent(organization.id)}`,
				{
					method: 'DELETE'
				}
			);
			const payload = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok) {
				throw new Error(getResponseMessage(payload, 'Could not remove this quiz.'));
			}
			toast.success('Quiz removed from group materials.');
			targetMaterial = null;
			await invalidateAll();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not remove this quiz.');
		} finally {
			removingId = null;
		}
	}
</script>

<svelte:head>
	<title>Materials | Free AP Practice</title>
</svelte:head>

<PageShell
	title="Materials"
	description={organization
		? `Quizzes and practice sets shared in ${organization.name}.`
		: 'Quizzes and practice sets shared in this group.'}
>
	{#if data.materials.length > 0}
		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{#each data.materials as material (material.id)}
				{@const subject = getSubjectPresentation(material.apClass)}
				{@const SubjectIcon = subject.icon}
				<Card.Root class="flex flex-col overflow-hidden border-border/70 py-0 shadow-sm">
					<Card.Content class="flex flex-1 flex-col gap-4 p-5">
						<div class="flex items-start gap-3">
							<div
								class="flex size-11 shrink-0 items-center justify-center rounded-xl {subject.iconClass}"
							>
								<SubjectIcon class="size-5" />
							</div>
							<div class="min-w-0 flex-1 space-y-1">
								<p class="line-clamp-2 leading-snug font-medium">{material.title}</p>
								<p class="text-sm text-muted-foreground">
									{material.apClass}
									{#if material.unit && material.unit !== 'All Units'}
										· {material.unit}
									{/if}
								</p>
							</div>
							{#if canManage}
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="ghost"
												size="icon"
												class="size-8 shrink-0 text-muted-foreground"
												aria-label="Quiz actions"
												disabled={removingId === material.id}
											>
												<EllipsisVerticalIcon class="size-4" />
											</Button>
										{/snippet}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end">
										<DropdownMenu.Item variant="destructive" onclick={() => openRemove(material)}>
											Remove from group
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							{/if}
						</div>

						<p class="text-sm text-muted-foreground">
							{material.itemCount} questions · {material.completionCount} completed
							{#if material.creatorName}
								· shared by <span class="ph-mask-pii">{material.creatorName}</span>
							{/if}
						</p>

						<Button href={practiceHref(material.slug)}>
							Practice
							<ArrowRightIcon class="size-4" />
						</Button>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{:else}
		<EmptyState
			title="No materials yet"
			description={canManage
				? 'Finish a practice quiz and use Share → Share to group to add it here for everyone.'
				: 'When owners share quizzes with the group, they will show up here.'}
			imageUrl={materialsImage}
		>
			<Button href={resolve('/app/practice')} variant="outline" class="rounded-full">
				Go to practice
			</Button>
		</EmptyState>
	{/if}
</PageShell>

<AlertDialog.Root bind:open={removeOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Remove {targetMaterial?.title ?? 'this quiz'}?</AlertDialog.Title>
			<AlertDialog.Description>
				This removes the quiz from group materials. Members will no longer see it on the Materials
				page. This cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={removingId !== null}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
				onclick={() => void confirmRemove()}
				disabled={removingId !== null}
			>
				Remove
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
