import { invalidate } from '$app/navigation';
import { resolve } from '$app/paths';
import {
	APP_LAYOUT_DEPENDENCY,
	ROOT_LAYOUT_DEPENDENCY
} from '$lib/layout-dependencies';

export type InvalidateScope =
	| 'app-layout'
	| 'authenticated-shell'
	| 'app-subtree'
	| '/app/materials'
	| '/app/members'
	| '/app/admin';

/** Invalidate SvelteKit load data for a known client refresh scope. */
export function invalidateClientData(scope: InvalidateScope): Promise<void> {
	switch (scope) {
		case 'app-layout':
			return invalidate(APP_LAYOUT_DEPENDENCY);
		case 'authenticated-shell':
			return Promise.all([
				invalidate(ROOT_LAYOUT_DEPENDENCY),
				invalidate(APP_LAYOUT_DEPENDENCY)
			]).then(() => undefined);
		case 'app-subtree':
			return invalidate((url) => url.pathname.startsWith('/app'));
		case '/app/materials':
		case '/app/members':
		case '/app/admin':
			return invalidate(resolve(scope));
		default: {
			const _exhaustive: never = scope;
			return _exhaustive;
		}
	}
}

export const invalidateAppLayout = (): Promise<void> => invalidateClientData('app-layout');

export const invalidateAuthenticatedShell = (): Promise<void> =>
	invalidateClientData('authenticated-shell');

export const invalidateAppSubtree = (): Promise<void> => invalidateClientData('app-subtree');

export const invalidateAppRoute = (
	route: Extract<InvalidateScope, `/app/${string}`>
): Promise<void> => invalidateClientData(route);
