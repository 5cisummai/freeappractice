export type FrqCourseProfile = {
	formatId: string;
	supportedFormats: readonly string[];
	generationConstraints: {
		minSections: number;
		maxSections: number;
		maxMaterials: number;
	};
	scoringMechanics: 'criterion-level-rubric';
	allowedResponseTypes: readonly ['text'];
	profileVersion: string;
	rubricVersion: string;
	generationGuidance: string;
	gradingGuidance: string;
};

const PROFILES: Record<string, FrqCourseProfile> = {
	'AP Biology': {
		formatId: 'scientific-analysis',
		supportedFormats: ['materials', 'multi-section', 'text'],
		generationConstraints: { minSections: 1, maxSections: 12, maxMaterials: 12 },
		scoringMechanics: 'criterion-level-rubric',
		allowedResponseTypes: ['text'],
		profileVersion: 'biology-v1',
		rubricVersion: 'biology-rubric-v1',
		generationGuidance:
			'Create an original data-rich scientific analysis task. Ask for causal reasoning, interpretation of evidence, and experimental or quantitative justification. Use only text, Markdown tables, and LaTeX; do not require drawing.',
		gradingGuidance:
			'Award points only for biologically correct claims connected to evidence or mechanisms. Definitions alone do not earn application or reasoning points.'
	},
	'AP Calculus AB': {
		formatId: 'calculus-worked-response',
		supportedFormats: ['materials', 'multi-section', 'text'],
		generationConstraints: { minSections: 1, maxSections: 12, maxMaterials: 12 },
		scoringMechanics: 'criterion-level-rubric',
		allowedResponseTypes: ['text'],
		profileVersion: 'calculus-ab-v1',
		rubricVersion: 'calculus-ab-rubric-v1',
		generationGuidance:
			'Create an original multi-part calculus task that rewards setup, mathematical reasoning, and interpretation separately. Use LaTeX and text only; do not require a hand-drawn graph.',
		gradingGuidance:
			'Award method and setup credit independently from arithmetic accuracy when the rubric allows it. Require mathematical justification when a conclusion depends on a theorem or sign analysis.'
	},
	'AP English Language': {
		formatId: 'argument-analysis',
		supportedFormats: ['materials', 'multi-section', 'text'],
		generationConstraints: { minSections: 1, maxSections: 12, maxMaterials: 12 },
		scoringMechanics: 'criterion-level-rubric',
		allowedResponseTypes: ['text'],
		profileVersion: 'english-language-v1',
		rubricVersion: 'english-language-rubric-v1',
		generationGuidance:
			'Create an original short passage or source set and a single analytical or argumentative writing task. The material must be wholly original and must not imitate an identifiable published or exam passage.',
		gradingGuidance:
			'Evaluate a defensible central claim, relevant evidence and reasoning, and control of the argument. Reward specific analysis rather than terminology alone.'
	}
};

export function getFrqCourseProfile(apClass: string): FrqCourseProfile | null {
	return PROFILES[apClass] ?? null;
}

export function getFrqCourseNames(): string[] {
	return Object.keys(PROFILES);
}
