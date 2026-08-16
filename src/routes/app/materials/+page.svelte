<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getSubjectPresentation } from '$lib/onboarding-subjects.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	const organization = $derived(data.activeOrganization);
	const canManage = $derived(data.canManageMaterials);
	let removingId = $state<string | null>(null);

	function practiceHref(slug: string): string {
		return `${resolve('/app/practice')}?shared=${encodeURIComponent(slug)}`;
	}

	async function removeMaterial(materialId: string) {
		if (!organization || removingId) return;
		removingId = materialId;
		try {
			const response = await apiFetch(`/api/shared-practice-sets/${materialId}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ organizationId: organization.id })
			});
			const payload = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok) {
				throw new Error(getResponseMessage(payload, 'Could not remove this quiz.'));
			}
			toast.success('Quiz removed from group materials.');
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
										<DropdownMenu.Item
											variant="destructive"
											onclick={() => void removeMaterial(material.id)}
										>
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
		<div
			class="rounded-2xl border border-dashed border-border/70 bg-card/50 px-6 py-12 text-center"
		>
			<div
				class="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"
			>
				<LayersIcon class="size-5" />
			</div>
			<h2 class="mt-4 font-medium">No materials yet</h2>
			<p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
				{#if canManage}
					Finish a practice quiz and use Share → Share to group to add it here for everyone.
				{:else}
					When owners share quizzes with the group, they will show up here.
				{/if}
			</p>
			<Button href={resolve('/app/practice')} variant="outline" class="mt-5 rounded-full">
				Go to practice
			</Button>
		</div>
	{/if}
</PageShell>
