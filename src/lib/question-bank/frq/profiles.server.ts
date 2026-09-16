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
