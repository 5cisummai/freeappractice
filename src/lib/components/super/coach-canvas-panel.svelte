<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { ensureGenerativeCanvasHtml } from '$lib/canvas/prepare-generative-canvas-html';
	import type { CanvasHtmlArtifact } from '$lib/canvas/types';

	type CoachCanvasEmbedProps = {
		artifact: CanvasHtmlArtifact;
	};

	let { artifact }: CoachCanvasEmbedProps = $props();

	const srcdoc = $derived(ensureGenerativeCanvasHtml(artifact.html));
	const MAX_FRAME_HEIGHT = 720;

	let heightBySrcdoc = $state<Record<string, number>>({});
	const reportedHeight = $derived(heightBySrcdoc[srcdoc]);
	const frameHeight = $derived(
		reportedHeight ? Math.min(reportedHeight, MAX_FRAME_HEIGHT) : undefined
	);
	const frameHeightCapped = $derived(reportedHeight != null && reportedHeight > MAX_FRAME_HEIGHT);

	const bindFrame: Attachment<HTMLIFrameElement> = (element) => {
		function handleMessage(event: MessageEvent) {
			if (event.source !== element.contentWindow) return;
			const data = event.data;
			if (!data || typeof data !== 'object' || Array.isArray(data)) return;
			const message = data as Record<string, unknown>;
			if (message.source !== 'pip-canvas' || message.version !== 1 || message.type !== 'resize') {
				return;
			}
			if (typeof message.height !== 'number' || !Number.isFinite(message.height)) return;
			const height = Math.max(1, Math.ceil(message.height));
			const key = element.getAttribute('srcdoc') ?? '';
			if (!key || heightBySrcdoc[key] === height) return;
			heightBySrcdoc = { ...heightBySrcdoc, [key]: height };
		}

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	};
</script>

<figure class="mt-3 w-full max-w-xl rounded-xl border border-border/70 bg-background">
	{#if artifact.title}
		<figcaption class="border-b border-border/60 px-3 py-2 text-xs font-medium text-foreground">
			{artifact.title}
		</figcaption>
	{/if}
	{#key srcdoc}
		<iframe
			{@attach bindFrame}
			title={artifact.accessibleDescription}
			sandbox="allow-scripts"
			{srcdoc}
			class={['block w-full border-0 bg-background', frameHeightCapped && 'overflow-y-auto']}
			style:height={frameHeight ? `${frameHeight}px` : '1px'}
		></iframe>
	{/key}
</figure>
