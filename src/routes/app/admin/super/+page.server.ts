import type { PageServerLoad } from './$types';
import { getSuperAdminOverview } from '$lib/super/admin.server';

export const load: PageServerLoad = () => getSuperAdminOverview();
