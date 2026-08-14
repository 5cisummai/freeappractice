type SiteNavItem = {
	href:
		| '/'
		| '/subjects'
		| '/blog'
		| '/summer'
		| '/stats'
		| '/about'
		| '/changelog'
		| '/pricing'
		| '/super'
		| '/privacy'
		| '/terms'
		| '/login'
		| '/signup';
	label: string;
};

type SiteNavGroup = {
	label: string;
	items: SiteNavItem[];
};

/** Primary links shown in the desktop and mobile topbar. */
export const topbarNavItems: SiteNavItem[] = [{ href: '/subjects', label: 'Subjects' }];

export const topbarResourceItems = [
	{
		href: '/super',
		label: 'Super',
		description: 'Personalized tutoring, Coach, insights, and study plans.'
	},
	{
		href: '/about',
		label: 'About',
		description: 'Learn more about Free AP Practice.'
	},
	{
		href: '/blog',
		label: 'Blog',
		description: 'Study tips, guides, and AP resources.'
	},
	{
		href: '/stats',
		label: 'Stats',
		description: 'See practice activity and progress.'
	}
] satisfies Array<SiteNavItem & { description: string }>;

export const topbarPricingItem: SiteNavItem = { href: '/pricing', label: 'Pricing' };

export const topbarAuthItems: SiteNavItem[] = [
	{ href: '/login', label: 'Sign in' },
	{ href: '/signup', label: 'Sign up free' }
];

/** Grouped footer navigation columns. */
export const footerNavGroups: SiteNavGroup[] = [
	{
		label: 'Practice',
		items: [
			{ href: '/subjects', label: 'Subjects' },
			{ href: '/stats', label: 'Stats' }
		]
	},
	{
		label: 'Learn',
		items: [
			{ href: '/blog', label: 'Blog' },
			{ href: '/summer', label: 'Summer Guide' }
		]
	},
	{
		label: 'Company',
		items: [
			{ href: '/about', label: 'About' },
			{ href: '/changelog', label: 'Changelog' }
		]
	},
	{
		label: 'Legal',
		items: [
			{ href: '/privacy', label: 'Privacy' },
			{ href: '/terms', label: 'Terms' }
		]
	}
];
