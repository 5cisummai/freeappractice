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
	/** First-answer letter (always set; same meaning as before). */
	selectedAnswer: string;
	correctAnswer: string;
	/** First-answer correctness (always set; same meaning as before). */
	isCorrect: boolean;
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
	leftPanel?: QuestionPanel;
	rightPanel?: QuestionPanel;
	hasStimulus: boolean;
};

export type QuestionCardProps = {
	class?: string;
	questionNumber?: string;
	selectedClass?: string;
	selectedUnit?: string;
	unitRange?: readonly number[];
	requestVersion?: number;
	selectedOption?: string | null;
	autoDetectLongQuestion?: boolean;
	longQuestionThresholdChars?: number;
	autoShowExplanation?: boolean;
	checkLabel?: string;
	nextLabel?: string;
	showExplanationLabel?: string;
	showUtilityActions?: boolean;
	skipLabel?: string;
	notLearnedLabel?: string;
	reportBugLabel?: string;
	onCheckAnswer?: (selectedOption: string | null) => void;
	onSkip?: () => void;
	onNotLearned?: () => void;
	onReportBug?: (context: BugReportContext) => void;
	onAnswered?: (result: AnswerResult) => void;
};
