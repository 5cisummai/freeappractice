import type { Snippet } from 'svelte';
import type { QuestionCardModel } from '$lib/question-bank/question-card-model';

export type TutorMode = 'hidden' | 'free' | 'personalized';

export type QuestionOption = {
	id: string;
	label: string;
	text: string;
};

export type QuestionPanel = {
	title: string;
	content: string[];
};

export type AnnotationTarget =
	| { kind: 'prompt'; paragraphIndex: number }
	| { kind: 'stimulus'; paragraphIndex: number }
	| { kind: 'option'; optionId: string };

export type TextAnnotationStyle = 'strike' | 'highlight';

export type TextAnnotation = {
	id: string;
	target: AnnotationTarget;
	start: number;
	end: number;
	style: TextAnnotationStyle;
	color?: string;
};

export type OptionMarks = {
	struckOptionIds: ReadonlySet<string>;
	highlightedOptionIds: ReadonlySet<string>;
};

export type QuestionFeedbackReason =
	| 'answer_incorrect'
	| 'question_unclear'
	| 'explanation_unclear';

export type QuestionLoadReason = 'skip' | 'not-learned' | 'next' | 'retry';

export type AddTextAnnotationInput = {
	target: AnnotationTarget;
	start: number;
	end: number;
	style: TextAnnotationStyle;
	color?: string;
};

export type QuestionCoreOpts = {
	getSelectedClass: () => string;
	getSelectedUnit: () => string;
	getUnitRange: () => readonly number[] | undefined;
	getRequestVersion: () => number;
	getPresetQuestionId: () => string | undefined;
	getQuestionNumber: () => string;
	getQuizMode: () => boolean;
	getQuizQuestion: () => GeneratedQuestion | null | undefined;
	getQuizAnswer: () => AnswerResult | null | undefined;
	getAutoShowExplanation: () => boolean;
	getSelectedOption: () => string | null;
	getMounted: () => boolean;
	setSelectedOption: (value: string | null) => void;
	onCheckAnswer?: (selectedOption: string | null) => void;
	onSkip?: () => void;
	onNotLearned?: () => void;
	onAnswered?: (result: AnswerResult) => void;
	onQuizNext?: () => void;
	onOptionSelected?: (selectedOption: string | null) => void;
};

export type ExamStatus = 'idle' | 'loading' | 'active' | 'review' | 'complete' | 'error';

export type ExamKind = 'quiz' | 'practice-test';

export type ExamMeta = {
	apClass?: string;
	unit?: string;
	kind?: ExamKind;
};

export type StartExamInput = {
	count: number;
	questions?: GeneratedQuestion[];
	timeLimitMs?: number | null;
	meta?: ExamMeta;
};

export type ExamCoreOpts = {
	loadQuestion?: (excludeIds: string[]) => Promise<GeneratedQuestion>;
	onComplete?: (snapshot: ExamSnapshot) => void | Promise<void>;
	getMounted?: () => boolean;
	maxConcurrentFill?: number;
	maxDuplicateRetries?: number;
	maxQuestionCount?: number;
};

export type ExamNavItem = {
	index: number;
	loaded: boolean;
	answered: boolean;
	flagged: boolean;
	failed: boolean;
};

export type ExamSnapshotItem = {
	position: number;
	questionId: string;
	selectedAnswer: string | null;
	timeTakenMs: number | null;
	flagged: boolean;
	isCorrect: boolean | null;
};

export type ExamScore = {
	correct: number;
	incorrect: number;
	unanswered: number;
	percent: number;
};

export type ExamSnapshot = {
	examId: string;
	kind: ExamKind;
	startedAt: string;
	completedAt: string;
	elapsedMs: number;
	timeLimitMs: number | null;
	meta: ExamMeta;
	items: ExamSnapshotItem[];
	score: ExamScore;
};

export type AnswerResult = {
	questionId?: string;
	questionNumber: string;
	selectedAnswer: string;
	correctAnswer: string;
	isCorrect: boolean;
	timeTakenMs: number;
};

export type BugReportContext = {
	questionId?: string;
	questionNumber: string;
	selectedClass?: string;
	selectedUnit?: string;
	prompt?: string;
	correctAnswer?: string;
	hasStimulus: boolean;
};

export type GeneratedQuestion = {
	questionId?: string;
	topic?: string;
	mainTopic?: string;
	source?: 'cached' | 'generated';
	prompt: string;
	options: QuestionOption[];
	correctAnswer?: string;
	explanation?: string;
	diagramSpec?: Record<string, unknown>;
	hasDiagram?: boolean;
	leftPanel?: QuestionPanel;
	rightPanel?: QuestionPanel;
	hasStimulus: boolean;
};

export type QuestionCardProps = {
	model: QuestionCardModel;
	class?: string;
	expanded?: boolean;
	onExpand?: () => void;
	controlsOpen?: boolean;
	practiceControls?: Snippet;
	headerActions?: Snippet;
	quizNavigation?: Snippet;
	nextDisabled?: boolean;
	onQuizNext?: () => void;
	onOptionSelected?: (selectedOption: string | null) => void;
	selectedOption?: string | null;
	autoDetectLongQuestion?: boolean;
	longQuestionThresholdChars?: number;
	autoShowExplanation?: boolean;
	checkLabel?: string;
	nextLabel?: string;
	showExplanationLabel?: string;
	showUtilityActions?: boolean;
	showFirstUseHint?: boolean;
	tutorMode?: TutorMode;
	isPersonalizedTutor?: boolean;
	skipLabel?: string;
	notLearnedLabel?: string;
	reportBugLabel?: string;
	onCheckAnswer?: (selectedOption: string | null) => void;
	onSkip?: () => void;
	onNotLearned?: () => void;
	onReportBug?: (context: BugReportContext) => void;
	onAnswered?: (result: AnswerResult) => void;
};
