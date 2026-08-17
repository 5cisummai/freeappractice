export const MAX_NAME_LENGTH = 64;

export function limitNameLength(name: string): string {
	return Array.from(name).slice(0, MAX_NAME_LENGTH).join('');
}
