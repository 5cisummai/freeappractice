type SiteNavItem = {
	href:
		| '/'
		| '/subjects'
		| '/blog'
		| '/summer'
		| '/stats'
		| '/about'
		| '/changelog'
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
export const topbarNavItems: SiteNavItem[] = [
	{ href: '/subjects', label: 'Subjects' },
	{ href: '/blog', label: 'Blog' },
	{ href: '/about', label: 'About' },
	{ href: '/stats', label: 'Stats' }
];

export const topbarAuthItems: SiteNavItem[] = [
	{ href: '/login', label: 'Sign In' },
	{ href: '/signup', label: 'Sign Up Free' }
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
