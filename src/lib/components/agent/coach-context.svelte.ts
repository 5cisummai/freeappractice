import { getContext, setContext, type Snippet } from 'svelte';

/** Page-surface coach toolbar snippet registered by CoachShell for the app topbar. */
class CoachPageToolbarState {
	snippet = $state.raw<Snippet | null>(null);

	setSnippet = (value: Snippet | null) => {
		this.snippet = value;
	};
}

const COACH_PAGE_TOOLBAR_CONTEXT = Symbol('freeappractice-coach-page-toolbar');

export function setCoachPageToolbar(): CoachPageToolbarState {
	return setContext(COACH_PAGE_TOOLBAR_CONTEXT, new CoachPageToolbarState());
}

export function useCoachPageToolbar(): CoachPageToolbarState {
	return getContext(COACH_PAGE_TOOLBAR_CONTEXT);
}
