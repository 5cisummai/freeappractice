import { getPlanAccess } from '$lib/super/entitlements.server';
import type { PlanAccess } from '$lib/super/types';

/** Share one billing/entitlement read across all handlers in a request. */
export function getPlanAccessForRequest(
	locals: Pick<App.Locals, 'planAccess'>,
	userId: string
): Promise<PlanAccess> {
	return (locals.planAccess ??= getPlanAccess(userId));
}
