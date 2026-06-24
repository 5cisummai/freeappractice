<script lang="ts">
	import { resolve } from '$app/paths';
	import { footerNavGroups } from '$lib/site-nav.js';
</script>

<footer class="bg border-t border-border">
	<div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
			<div class="flex flex-col gap-1.5 lg:col-span-1">
				<p class="font-semibold text-foreground">
					<a href={resolve('/')} class="underline-offset-2 hover:text-foreground hover:underline"
						>Free AP Practice</a
					>
				</p>
				<p class="max-w-xs text-xs leading-5 text-muted-foreground">
					Literally free AP practice questions.
				</p>
			</div>

			{#each footerNavGroups as group (group.label)}
				<nav class="flex flex-col gap-2" aria-label="{group.label} links">
					<p class="text-xs font-semibold tracking-wide text-foreground uppercase">
						{group.label}
					</p>
					<ul class="flex flex-col gap-1.5">
						{#each group.items as item (item.href)}
							<li>
								<a
									href={resolve(item.href)}
									class="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
								>
									{item.label}
								</a>
							</li>
						{/each}
					</ul>
				</nav>
			{/each}
		</div>

		<div
			class="mt-8 flex flex-col gap-4 border-t border-border pt-5 text-sm sm:flex-row sm:items-center sm:justify-between"
		>
			<nav class="flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground" aria-label="Contact links">
				<a
					href="mailto:support@freeappractice.org"
					class="underline-offset-2 hover:text-foreground hover:underline">Email</a
				>
				<a
					href="https://www.youtube.com/channel/UC8RyXwmKWUI7XLHCcEL16JA"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 underline-offset-2 hover:text-foreground hover:underline"
				>
					YouTube
				</a>
				<a
					href="https://instagram.com/freeappractice"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 underline-offset-2 hover:text-foreground hover:underline"
				>
					Instagram
				</a>
				<a
					href="https://github.com/5cisummai/freeappractice"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 underline-offset-2 hover:text-foreground hover:underline"
				>
					GitHub
				</a>
			</nav>

			<p class="text-xs text-muted-foreground sm:text-right">© 2026 Free AP Practice</p>
		</div>
	</div>
</footer>
