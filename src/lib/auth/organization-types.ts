export const ORG_TYPES = ['personal', 'group', 'school', 'enterprise'] as const;

export type OrgType = (typeof ORG_TYPES)[number];

export const MAX_FREE_GROUP_ORGS = 3;

export const SHARE_TOKEN_PREFIX = 'join_';

export type OrganizationRole = 'owner' | 'admin' | 'member';

export type UserOrganization = {
	id: string;
	name: string;
	slug: string;
	orgType: OrgType;
	shareToken: string | null;
	role: OrganizationRole;
	createdAt: Date;
};

export function isOrgType(value: unknown): value is OrgType {
	return typeof value === 'string' && (ORG_TYPES as readonly string[]).includes(value);
}

export function parseOrgType(value: unknown): OrgType | null {
	return isOrgType(value) ? value : null;
}

/** Personal and group orgs share one user-global progress namespace. */
export function orgSharesUserProgress(orgType: OrgType): boolean {
	switch (orgType) {
		case 'personal':
		case 'group':
			return true;
		case 'school':
		case 'enterprise':
			return false;
		default: {
			const exhaustive: never = orgType;
			return exhaustive;
		}
	}
}

/** Super billing stays per-user in personal and group orgs only. */
export function orgUsesUserSuper(orgType: OrgType): boolean {
	return orgSharesUserProgress(orgType);
}

export function isShareToken(value: string): boolean {
	return value.startsWith(SHARE_TOKEN_PREFIX) && value.length > SHARE_TOKEN_PREFIX.length;
}

export const PERSONAL_ORG_NAME = 'My Space';

export function personalOrgSlug(userId: string): string {
	const compact = userId.toLowerCase().replace(/[^a-z0-9-]/g, '');
	return `u-${compact || 'user'}`;
}

export function slugifyOrgName(name: string, suffix: string): string {
	const base = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
	return `${base || 'group'}-${suffix}`;
}

const PASTEL_CLASSES = [
	'bg-rose-200 text-rose-900',
	'bg-sky-200 text-sky-900',
	'bg-amber-200 text-amber-900',
	'bg-emerald-200 text-emerald-900',
	'bg-violet-200 text-violet-900',
	'bg-orange-200 text-orange-900',
	'bg-teal-200 text-teal-900',
	'bg-fuchsia-200 text-fuchsia-900'
] as const;

export function orgAvatarClass(orgId: string): string {
	let hash = 0;
	for (let i = 0; i < orgId.length; i++) {
		hash = (hash * 31 + orgId.charCodeAt(i)) >>> 0;
	}
	return PASTEL_CLASSES[hash % PASTEL_CLASSES.length] ?? PASTEL_CLASSES[0];
}

export function orgAvatarLetter(name: string): string {
	const letter = name.trim().charAt(0);
	return letter ? letter.toUpperCase() : 'O';
}
