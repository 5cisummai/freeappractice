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

export type FRQPart = {
	label: string;
	question: string;
	pointValue: number;
	scoringCriteria: string;
	modelAnswer: string;
};

export type FRQQuestion = {
	questionId?: string;
	prompt: string;
	context?: string | null;
	parts: FRQPart[];
	totalPoints: number;
};

export type FRQPartGrade = {
	label: string;
	pointsEarned: number;
	pointsAvailable: number;
	score: number;
	feedback: string;
};

export type FRQGrade = {
	parts: FRQPartGrade[];
	totalScore: number;
	overallFeedback: string;
};

export type FRQAnswerResult = {
	questionId?: string;
	questionNumber: string;
	aiScore: number;
	pointsEarned: number;
	totalPoints: number;
	timeTakenMs: number;
};

export type QuestionCardProps = {
	class?: string;
	mode?: 'mcq' | 'frq';
	subject?: string;
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
	onFRQAnswered?: (result: FRQAnswerResult) => void;
};
