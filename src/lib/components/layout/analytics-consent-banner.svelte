<script lang="ts">
	import { resolve } from '$app/paths';
	import { privacy } from '$lib/client/privacy.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
</script>

{#if privacy.initialized && privacy.analyticsConsent === null}
	<div
		class="fixed right-4 bottom-4 left-4 z-50 max-w-sm rounded-xl border border-border bg-background p-4 shadow-lg sm:left-auto"
		role="dialog"
		aria-labelledby="analytics-consent-title"
		aria-describedby="analytics-consent-desc"
	>
		<p id="analytics-consent-title" class="text-sm font-medium text-foreground">
			Cookie preferences
		</p>
		<p id="analytics-consent-desc" class="mt-1.5 text-sm text-muted-foreground">
			Optional analytics help improve the product. Change anytime in Settings.
			<a href={resolve('/privacy')} class="underline underline-offset-4">Privacy Policy</a>.
		</p>
		<div class="mt-4 flex flex-wrap gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={() => privacy.setAnalyticsConsent('denied')}
			>
				Reject
			</Button>
			<Button type="button" size="sm" onclick={() => privacy.setAnalyticsConsent('granted')}>
				Accept
			</Button>
		</div>
	</div>
{/if}
