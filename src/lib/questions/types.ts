import type { Snippet } from 'svelte';
import type { QuestionCardModel } from '$lib/questions/question-card-model';

export type TutorMode = 'hidden' | 'free' | 'personalized';

export type QuestionOption = {
	id: string;
	label: string;
	text: string;
};

type QuestionPanel = {
	title: string;
	content: string[];
};

export type AnswerResult = {
	questionId?: string;
	questionNumber: string;
	/** First-answer letter; omitted when the student reveals before answering. */
	selectedAnswer?: string;
	correctAnswer: string;
	/** First-answer correctness; omitted when the student reveals before answering. */
	isCorrect?: boolean;
	timeTakenMs: number;
	/** Present only for multi-attempt treatment completions. */
	finalAnswer?: string;
	answerCount?: number;
	hintsShown?: number;
	terminalOutcome?: 'correct' | 'revealed' | 'max_attempts';
	displayedVariant?: 'control' | 'multi_attempt_hints';
	experimentKey?: string;
	experimentVersion?: number;
	/** Full answer sequence for multi-attempt treatment (classic path omits). */
	answers?: Array<'A' | 'B' | 'C' | 'D'>;
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
	source?: 'cached' | 'generated';
	prompt: string;
	options: QuestionOption[];
	correctAnswer?: string;
	explanation?: string;
	hint1?: string;
	hint2?: string;
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
