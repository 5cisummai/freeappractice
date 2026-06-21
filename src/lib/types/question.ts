export type QuestionOption = {
	id: string;
	label: string;
	text: string;
};

export type QuestionPanel = {
	title: string;
	content: string[];
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
	customTopic?: string;
	prompt?: string;
	correctAnswer?: string;
	hasStimulus: boolean;
};

export type GeneratedQuestion = {
	questionId?: string;
	prompt: string;
	options: QuestionOption[];
	correctAnswer?: string;
	explanation?: string;
	leftPanel?: QuestionPanel;
	rightPanel?: QuestionPanel;
	hasStimulus: boolean;
};

export type QuestionCardProps = {
	class?: string;
	questionNumber?: string;
	selectedClass?: string;
	selectedUnit?: string;
	/** Required when selectedUnit is the custom-topic sentinel. */
	customTopic?: string;
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
