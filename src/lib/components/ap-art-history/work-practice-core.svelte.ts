import { SvelteSet } from 'svelte/reactivity';
import {
	fetchApArtHistoryWorkByNumber,
	fetchApArtHistoryWorks,
	ApArtHistoryRequestError
} from '#lib/ap-art-history/request.client.js';
import {
	gradeIdentifierInputs,
	type IdentifierGradeResult,
	type IdentifierInputs
} from '#lib/ap-art-history/match-identifiers.js';
import type { ApArtHistoryWorkRow } from '#lib/ap-art-history/types.js';

const MAX_SEEN_WORK_NUMBERS = 40;

export type WorkPracticeCoreOpts = {
	getContentArea: () => string;
	getRequestVersion: () => number;
};

function pickRandomWork(
	items: ApArtHistoryWorkRow[],
	exclude: ReadonlySet<number>
): ApArtHistoryWorkRow | null {
	const pool = items.filter((item) => !exclude.has(item.number));
	const candidates = pool.length > 0 ? pool : items;
	if (!candidates.length) return null;
	return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

export function createWorkPracticeCore(opts: WorkPracticeCoreOpts) {
	let work = $state<ApArtHistoryWorkRow | null>(null);
	let isLoading = $state(false);
	let loadFailed = $state(false);
	let statusMessage = $state('');
	let seenWorkNumbers = $state<number[]>([]);
	let hasChecked = $state(false);
	let gradeResult = $state<IdentifierGradeResult | null>(null);

	let inputs = $state<IdentifierInputs>({
		title: '',
		artistLocation: '',
		date: '',
		medium: ''
	});

	const showEmptyState = $derived(
		!isLoading && !loadFailed && !work && opts.getRequestVersion() === 0
	);
	const showErrorState = $derived(!isLoading && loadFailed && !work);
	const showWorkCard = $derived(Boolean(work) && !isLoading);

	function rememberWorkNumber(number: number): void {
		if (seenWorkNumbers.includes(number)) return;
		seenWorkNumbers = [...seenWorkNumbers, number].slice(-MAX_SEEN_WORK_NUMBERS);
	}

	function resetInputs(): void {
		inputs = { title: '', artistLocation: '', date: '', medium: '' };
		hasChecked = false;
		gradeResult = null;
	}

	async function loadWorkForPractice(): Promise<void> {
		const contentArea = opts.getContentArea().trim();
		if (!contentArea) {
			statusMessage = 'Select a content area to start practicing.';
			return;
		}

		isLoading = true;
		loadFailed = false;
		statusMessage = '';
		work = null;
		resetInputs();

		try {
			const list = await fetchApArtHistoryWorks({ contentArea, limit: 250, page: 1 });
			const exclude = new SvelteSet(seenWorkNumbers);
			let next = pickRandomWork(list.items, exclude);

			if (!next && list.total > 0) {
				const full = await fetchApArtHistoryWorks({ contentArea, limit: 250, page: 1 });
				next = pickRandomWork(full.items, new SvelteSet<number>());
			}

			if (!next) {
				loadFailed = true;
				statusMessage = 'No works found for this content area.';
				return;
			}

			const detailed = await fetchApArtHistoryWorkByNumber(next.number);
			work = detailed;
			rememberWorkNumber(detailed.number);
		} catch (error) {
			loadFailed = true;
			statusMessage =
				error instanceof ApArtHistoryRequestError
					? error.message
					: 'Failed to load a work. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	function checkAnswers(): void {
		if (!work) return;
		gradeResult = gradeIdentifierInputs(work, inputs);
		hasChecked = true;
	}

	async function loadNextWork(): Promise<void> {
		await loadWorkForPractice();
	}

	let lastRequestVersion = 0;

	$effect(() => {
		const version = opts.getRequestVersion();
		if (version <= 0 || version === lastRequestVersion) return;
		lastRequestVersion = version;
		void loadWorkForPractice();
	});

	return {
		get work() {
			return work;
		},
		get isLoading() {
			return isLoading;
		},
		get loadFailed() {
			return loadFailed;
		},
		get statusMessage() {
			return statusMessage;
		},
		get showEmptyState() {
			return showEmptyState;
		},
		get showErrorState() {
			return showErrorState;
		},
		get showWorkCard() {
			return showWorkCard;
		},
		get inputs() {
			return inputs;
		},
		set inputs(value: IdentifierInputs) {
			inputs = value;
		},
		get hasChecked() {
			return hasChecked;
		},
		get gradeResult() {
			return gradeResult;
		},
		loadWorkForPractice,
		loadNextWork,
		checkAnswers,
		retryLoad: loadWorkForPractice
	};
}
