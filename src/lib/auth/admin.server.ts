import { env } from '$env/dynamic/private';

export type AdminUser = {
	id: string;
	role?: string | null | string[];
};

export function getAdminUserIds(): string[] {
	return (env.BETTER_AUTH_ADMIN_USER_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
}

export function isAdminUser(user: AdminUser | null | undefined): boolean {
	if (!user) return false;
	if (getAdminUserIds().includes(user.id)) return true;

	const roles = Array.isArray(user.role) ? user.role : (user.role ?? '').split(',');
	return roles.map((role) => role.trim()).includes('admin');
}
