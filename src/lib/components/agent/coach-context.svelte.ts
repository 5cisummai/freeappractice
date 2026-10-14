import { getContext, setContext, type Snippet } from 'svelte';

type Getter<T> = () => T;

export type CoachSidebarStateProps = {
	open: Getter<boolean>;
	setOpen: (open: boolean) => void;
};

class CoachSidebarState {
	readonly props: CoachSidebarStateProps;
	open = $derived.by(() => this.props.open());
	state = $derived.by(() => (this.open ? 'expanded' : 'collapsed'));

	constructor(props: CoachSidebarStateProps) {
		this.props = props;
	}

	toggle = () => {
		this.props.setOpen(!this.open);
	};
}

const COACH_SIDEBAR_CONTEXT = Symbol('freeappractice-coach-sidebar');

export function setCoachSidebar(props: CoachSidebarStateProps): CoachSidebarState {
	return setContext(COACH_SIDEBAR_CONTEXT, new CoachSidebarState(props));
}

export function useCoachSidebar(): CoachSidebarState {
	return getContext(COACH_SIDEBAR_CONTEXT);
}

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
