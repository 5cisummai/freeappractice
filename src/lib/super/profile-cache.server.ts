import type { TutorProfileView } from '$lib/super/types';
import { getTutorProfileView } from '$lib/super/profile.server';

/**
 * Share one profile read across the hook and downstream handlers for a request.
 * The promise is intentionally request-local, so writes on later requests cannot
 * observe a stale process-wide cache.
 */
export function getTutorProfileViewForRequest(
	locals: Pick<App.Locals, 'tutorProfileView'>,
	userId: string
): Promise<TutorProfileView> {
	return (locals.tutorProfileView ??= getTutorProfileView(userId));
}
