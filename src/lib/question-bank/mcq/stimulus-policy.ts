import { AP_DATA } from '$lib/data/ap-data';

export type StimulusMode = 'text' | 'diagram' | 'mixed';
export type StimulusProfile = {
	id: string;
	minChildren: number;
	targetChildren: number;
	maxChildren: number;
	allowedModes: StimulusMode[];
	diagramTypes: string[];
	weight: number;
};

export type StimulusPolicy = {
	version: 1;
	enabled: boolean;
	/** Optional exact unit allowlist for course-specific rollout. Omitted means all units. */
	enabledUnits?: string[];
	quizTargetQuestionPercent: number;
	targetBasis: 'official' | 'official-derived' | 'product-calibrated';
	setSizeBasis: 'official' | 'official-derived' | 'product-calibrated' | 'unknown';
	setsEnabled: boolean;
	restrictions: string[];
	allowDiscreteDiagrams: boolean;
	allowedDiscreteDiagramTypes: string[];
	defaultProfileIds: string[];
	profiles: StimulusProfile[];
};

const scienceDiagramTypes = [
	'data-plot',
	'table',
	'process-diagram',
	'experimental-setup',
	'function-graph'
];

const policies: Record<string, StimulusPolicy> = {
	'AP Biology': {
		version: 1,
		enabled: false,
		quizTargetQuestionPercent: 25,
		targetBasis: 'product-calibrated',
		setSizeBasis: 'official',
		setsEnabled: true,
		restrictions: ['original-ai-text-or-semantic-diagram-only', 'no-authentic-attribution'],
		allowDiscreteDiagrams: true,
		allowedDiscreteDiagramTypes: scienceDiagramTypes,
		defaultProfileIds: ['shared-data'],
		profiles: [
			{
				id: 'shared-data',
				minChildren: 4,
				targetChildren: 4,
				maxChildren: 5,
				allowedModes: ['text', 'diagram', 'mixed'],
				diagramTypes: scienceDiagramTypes,
				weight: 1
			}
		]
	},
	'AP Chemistry': {
		version: 1,
		enabled: false,
		quizTargetQuestionPercent: 25,
		targetBasis: 'product-calibrated',
		setSizeBasis: 'product-calibrated',
		setsEnabled: true,
		restrictions: ['original-ai-text-or-semantic-diagram-only', 'no-authentic-attribution'],
		allowDiscreteDiagrams: true,
		allowedDiscreteDiagramTypes: [
			...scienceDiagramTypes,
			'particle-diagram',
			'apparatus-schematic'
		],
		defaultProfileIds: ['shared-stimulus'],
		profiles: [
			{
				id: 'shared-stimulus',
				minChildren: 2,
				targetChildren: 3,
				maxChildren: 4,
				allowedModes: ['text', 'diagram', 'mixed'],
				diagramTypes: [...scienceDiagramTypes, 'particle-diagram', 'apparatus-schematic'],
				weight: 1
			}
		]
	},
	'AP Physics 1': {
		version: 1,
		enabled: false,
		quizTargetQuestionPercent: 25,
		targetBasis: 'product-calibrated',
		setSizeBasis: 'product-calibrated',
		setsEnabled: true,
		restrictions: ['original-ai-text-or-semantic-diagram-only', 'no-authentic-attribution'],
		allowDiscreteDiagrams: true,
		allowedDiscreteDiagramTypes: [
			'function-graph',
			'data-plot',
			'table',
			'free-body',
			'inclined-plane',
			'circuit',
			'field-map',
			'motion-map',
			'vector-scene',
			'wave-diagram'
		],
		defaultProfileIds: ['shared-stimulus'],
		profiles: [
			{
				id: 'shared-stimulus',
				minChildren: 2,
				targetChildren: 3,
				maxChildren: 4,
				allowedModes: ['text', 'diagram', 'mixed'],
				diagramTypes: [
					'function-graph',
					'data-plot',
					'table',
					'free-body',
					'inclined-plane',
					'circuit',
					'field-map',
					'motion-map',
					'vector-scene',
					'wave-diagram'
				],
				weight: 1
			}
		]
	},
	'AP Human Geography': {
		version: 1,
		enabled: false,
		quizTargetQuestionPercent: 35,
		targetBasis: 'official-derived',
		setSizeBasis: 'product-calibrated',
		setsEnabled: true,
		restrictions: [
			'exclude-photographs-and-landscapes',
			'original-ai-text-or-semantic-diagram-only'
		],
		allowDiscreteDiagrams: true,
		allowedDiscreteDiagramTypes: ['map', 'table', 'data-plot', 'function-graph'],
		defaultProfileIds: ['shared-geographic-stimulus'],
		profiles: [
			{
				id: 'shared-geographic-stimulus',
				minChildren: 2,
				targetChildren: 3,
				maxChildren: 4,
				allowedModes: ['text', 'diagram', 'mixed'],
				diagramTypes: ['map', 'table', 'data-plot', 'function-graph'],
				weight: 1
			}
		]
	},
	'AP World History': {
		version: 1,
		enabled: false,
		quizTargetQuestionPercent: 75,
		targetBasis: 'product-calibrated',
		setSizeBasis: 'official',
		setsEnabled: true,
		restrictions: [
			'no-fabricated-primary-source-attribution',
			'original-ai-text-or-semantic-diagram-only'
		],
		allowDiscreteDiagrams: true,
		allowedDiscreteDiagramTypes: ['map', 'table', 'data-plot', 'function-graph'],
		defaultProfileIds: ['historical-stimulus'],
		profiles: [
			{
				id: 'historical-stimulus',
				minChildren: 3,
				targetChildren: 3,
				maxChildren: 4,
				allowedModes: ['text', 'diagram', 'mixed'],
				diagramTypes: ['map', 'table', 'data-plot', 'function-graph'],
				weight: 1
			}
		]
	}
};

const disabledPolicy: StimulusPolicy = {
	version: 1,
	enabled: false,
	quizTargetQuestionPercent: 0,
	targetBasis: 'product-calibrated',
	setSizeBasis: 'unknown',
	setsEnabled: false,
	restrictions: ['unsupported-course'],
	allowDiscreteDiagrams: false,
	allowedDiscreteDiagramTypes: [],
	defaultProfileIds: [],
	profiles: []
};

export function getStimulusPolicy(className: string): StimulusPolicy {
	return policies[className] ?? disabledPolicy;
}

export function getPolicyProfile(className: string, profileId: string): StimulusProfile | null {
	return getStimulusPolicy(className).profiles.find((profile) => profile.id === profileId) ?? null;
}

export function isStimulusPolicyEnabledForUnit(policy: StimulusPolicy, unit?: string): boolean {
	if (!policy.enabled) return false;
	if (!policy.enabledUnits?.length) return true;
	return policy.enabledUnits.includes(unit?.trim() ?? '');
}

export function getSupportedStimulusCourseNames(): string[] {
	return AP_DATA.courses.map((course) => course.name).filter((name) => Boolean(policies[name]));
}
