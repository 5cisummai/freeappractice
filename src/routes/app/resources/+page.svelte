<script lang="ts">
	import ResourceImageCard from '$lib/components/blog/resource-image-card.svelte';
	import PageShell from '$lib/components/layout/page-shell.svelte';

	const blogResources = [
		{
			href: '/blog',
			label: 'Open the blog',
			description: 'Browse all current study guides, updates, and strategy posts.',
			coverImage:
				'https://public.assets.freeappractice.org/marissa-grootes-flRm0z3MEoA-unsplash.jpg'
		},
		{
			href: '/blog/science-of-studying',
			label: 'Science of Studying',
			description: 'Research-backed strategies for spacing, retrieval, and retention.',
			coverImage: 'https://public.assets.freeappractice.org/zoshua-colah-klbApl9mxr0-unsplash.jpg'
		},
		{
			href: '/blog/summer-ap-study-plan',
			label: 'Summer AP Study Plan',
			description:
				'How to preview AP classes over the summer with light daily work — without burning out.',
			coverImage: 'https://public.assets.freeappractice.org/brice-cooper-Qc7BB9E0lMc-unsplash.jpg'
		}
	];

	const externalResources = [
		{
			href: 'https://apstudents.collegeboard.org/',
			label: 'AP Students',
			description:
				'Official College Board landing page for AP exam information and course details.',
			coverImage:
				'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&h=500&q=80'
		},
		{
			href: 'https://apcentral.collegeboard.org/',
			label: 'AP Central',
			description: 'Official course materials, scoring guidelines, and exam resources.',
			coverImage:
				'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&h=500&q=80'
		},
		{
			href: 'https://www.khanacademy.org/',
			label: 'Khan Academy',
			description: 'Free practice and review for a wide range of academic subjects.',
			coverImage:
				'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&h=500&q=80'
		},
		{
			href: 'https://www.fiveable.me/',
			label: 'Fiveable',
			description: 'Community study guides, live review sessions, and AP support.',
			coverImage:
				'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&h=500&q=80'
		}
	];

	const scrollRowClass =
		'no-scrollbar mt-4 flex list-none snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth p-0 pb-1';
	const cardItemClass = 'w-[min(100%,18rem)] shrink-0 snap-start sm:w-72 lg:w-80';
</script>

<svelte:head>
	<title>Resources | Free AP Practice</title>
	<meta
		name="description"
		content="Study guides from the Free AP Practice blog and trusted external AP resources."
	/>
</svelte:head>

<PageShell
	title="Resources"
	description="Study guides and official links worth keeping in your AP toolkit."
>
	<div class="space-y-12">
		<section>
			<h2 class="font-display text-2xl font-medium tracking-tight">Blogs</h2>
			<ul class={scrollRowClass}>
				{#each blogResources as resource (resource.href)}
					<li class={cardItemClass}>
						<ResourceImageCard
							href={resource.href}
							title={resource.label}
							description={resource.description}
							coverImage={resource.coverImage}
							badge="Blog"
						/>
					</li>
				{/each}
			</ul>
		</section>

		<section>
			<h2 class="font-display text-2xl font-medium tracking-tight">More resources</h2>
			<ul class={scrollRowClass}>
				{#each externalResources as resource (resource.href)}
					<li class={cardItemClass}>
						<ResourceImageCard
							href={resource.href}
							title={resource.label}
							description={resource.description}
							coverImage={resource.coverImage}
							external={true}
							badge="External"
						/>
					</li>
				{/each}
			</ul>
		</section>
	</div>
</PageShell>
