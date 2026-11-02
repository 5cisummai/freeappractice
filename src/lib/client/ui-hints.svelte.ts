export const UI_HINTS_COOKIE_NAME = 'fap_ui_hints';
const UI_HINTS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const UI_HINTS_COOKIE_VERSION = 'v1';

export type UiHintId =
	| 'dashboard-practice'
	| 'practice-selector'
	| 'question-tools'
	| 'tutor-widget';

export const FIRST_USE_HINT_ORDER: readonly UiHintId[] = [
	'dashboard-practice',
	'practice-selector',
	'question-tools',
	'tutor-widget'
];

const UI_HINT_IDS: ReadonlySet<UiHintId> = new Set(FIRST_USE_HINT_ORDER);

function readDismissedHints(): Set<UiHintId> {
	if (typeof document === 'undefined') return new Set();

	const cookie = document.cookie
		.split('; ')
		.find((part) => part.startsWith(`${UI_HINTS_COOKIE_NAME}=`))
		?.slice(UI_HINTS_COOKIE_NAME.length + 1);

	if (!cookie) return new Set();

	try {
		const value = decodeURIComponent(cookie);
		if (!value.startsWith(`${UI_HINTS_COOKIE_VERSION}:`)) return new Set();

		return new Set(
			value
				.slice(UI_HINTS_COOKIE_VERSION.length + 1)
				.split(',')
				.filter((id): id is UiHintId => UI_HINT_IDS.has(id as UiHintId))
		);
	} catch {
		return new Set();
	}
}

function writeDismissedHints(hints: Set<UiHintId>): void {
	if (typeof document === 'undefined') return;

	const secure = window.location.protocol === 'https:' ? '; Secure' : '';
	const value = encodeURIComponent(
		`${UI_HINTS_COOKIE_VERSION}:${Array.from(hints).sort().join(',')}`
	);

	document.cookie = `${UI_HINTS_COOKIE_NAME}=${value}; path=/; max-age=${UI_HINTS_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function hasSeenUiHint(id: UiHintId): boolean {
	return readDismissedHints().has(id);
}

export function getActiveFirstUseHintId(): UiHintId | null {
	for (const id of FIRST_USE_HINT_ORDER) {
		if (!hasSeenUiHint(id)) return id;
	}
	return null;
}

let firstUseHintQueueRevision = $state(0);

export function getFirstUseHintQueueRevision(): number {
	return firstUseHintQueueRevision;
}

function bumpFirstUseHintQueue(): void {
	firstUseHintQueueRevision += 1;
}

export function markUiHintSeen(id: UiHintId): void {
	const hints = readDismissedHints();
	hints.add(id);
	writeDismissedHints(hints);
	bumpFirstUseHintQueue();
}

export function resetUiHints(): void {
	if (typeof document === 'undefined') return;

	const secure = window.location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${UI_HINTS_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${secure}`;
	bumpFirstUseHintQueue();
}
