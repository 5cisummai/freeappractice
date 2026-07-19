import { env } from '$env/dynamic/private';

export function getAdminUserIds(): string[] {
	return (env.BETTER_AUTH_ADMIN_USER_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
}

export function isAdminUser(user: { id: string } | null | undefined): boolean {
	if (!user) return false;
	return getAdminUserIds().includes(user.id);
}
