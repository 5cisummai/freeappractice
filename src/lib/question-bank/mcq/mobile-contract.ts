/**
 * Native MCQ response contract for `POST /api/question` and
 * `GET /api/question/by-id/[questionId]`.
 *
 * Text fields (`question`, options, `explanation`, stimulus text) may contain
 * Markdown with KaTeX math (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`). Safe
 * rendering must allowlist link/image URLs the same way web does
 * (`http(s)`, `mailto:`, absolute paths, and hashes). Do not execute HTML.
 *
 * `diagramSpec` is an examfig DiagramSpec JSON object. Until the native client
 * can render examfig, skip questions where `hasDiagram` is true or
 * `diagramSpec` / `stimulus.diagramSpec` is present.
 */
export type MobileMcqStimulus = {
	text: string | null;
	diagramSpec: Record<string, unknown> | null;
	provenance: 'ai-generated-original' | 'legacy-unknown';
};

export type MobileMcqAnswerBody = {
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	mainTopic: string;
	topicsCovered: string;
	difficulty?: 'easy' | 'medium' | 'hard' | null;
	subtopicId?: string | null;
	choiceExplanations?: {
		A: string;
		B: string;
		C: string;
		D: string;
	} | null;
	diagramSpec: Record<string, unknown> | null;
	hasDiagram: boolean;
	stimulus?: MobileMcqStimulus;
	stimulusId?: string | null;
	stimulusPosition?: number | null;
	stimulusQuestionCount?: number | null;
};

export type MobileMcqQuestionResponse = {
	answer: MobileMcqAnswerBody;
	provider: string;
	model: string;
	cached: boolean;
	questionId: string;
	exclusionsReset?: boolean;
};

/** Fields that currently require native rendering work beyond plain text. */
export const MOBILE_MCQ_UNSUPPORTED_RENDER_FIELDS = [
	'diagramSpec',
	'hasDiagram',
	'stimulus.diagramSpec'
] as const;
