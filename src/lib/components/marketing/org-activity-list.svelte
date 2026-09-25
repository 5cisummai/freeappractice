<script lang="ts">
	import {
		orgAvatarClass,
		orgAvatarLetter,
		type OrganizationActivityItem
	} from '$lib/auth/organization-types';

	let { items, preview = false }: { items: OrganizationActivityItem[]; preview?: boolean } =
		$props();

	function activityTarget(item: OrganizationActivityItem): string {
		if (item.quizTitle) return item.quizTitle;
		if (item.unit && item.unit !== 'All Units') return `${item.apClass} — ${item.unit}`;
		return item.apClass;
	}

	function formatRelativeTime(iso: string): string {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
		if (diffMinutes < 1) return 'Just now';
		if (diffMinutes < 60) return `${diffMinutes}m ago`;
		const diffHours = Math.floor(diffMinutes / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
	}
</script>

{#if items.length > 0}
	<ul class="divide-y divide-border/70">
		{#each items as item (item.id)}
			<li
				class={preview
					? 'flex items-center gap-3 px-5 py-4'
					: 'flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4'}
			>
				<span
					class="flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold {orgAvatarClass(
						item.userId
					)}"
				>
					{orgAvatarLetter(item.userName)}
				</span>
				<div class="min-w-0 flex-1">
					<p class="text-sm">
						<span class="font-medium" class:ph-mask-pii={!preview}>{item.userName}</span>
						scored <span class="font-medium tabular-nums">{item.scorePercent}%</span> on
						<span class="font-medium">{activityTarget(item)}</span>
					</p>
					<p class="text-xs text-muted-foreground">
						<time datetime={item.completedAt}>{formatRelativeTime(item.completedAt)}</time>
					</p>
				</div>
			</li>
		{/each}
	</ul>
{:else}
	<div class="px-4 py-5 text-sm text-muted-foreground sm:px-5 sm:py-6">
		No quiz activity in the last two weeks. Finish a practice quiz to show up here.
	</div>
{/if}
