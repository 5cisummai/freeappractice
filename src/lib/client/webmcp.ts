import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

type ModelContextTool = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute: (input: Record<string, unknown>) => Promise<unknown>;
};

type ModelContext = {
	registerTool: (tool: ModelContextTool) => Promise<unknown>;
};

declare global {
	interface Document {
		modelContext?: ModelContext;
	}
}

const AP_SUBJECTS = [
	'AP Biology',
	'AP Chemistry',
	'AP Physics 1',
	'AP Calculus AB',
	'AP Calculus BC',
	'AP Statistics',
	'AP US History',
	'AP World History',
	'AP Psychology',
	'AP Computer Science A'
];

export function registerWebMcpTools(): void {
	if (typeof document === 'undefined' || !document.modelContext?.registerTool) {
		return;
	}

	const { registerTool } = document.modelContext;

	void registerTool({
		name: 'list_subjects',
		description: 'List AP subjects available for practice on Free AP Practice.',
		inputSchema: {
			type: 'object',
			properties: {},
			additionalProperties: false
		},
		execute: async () => ({
			subjects: AP_SUBJECTS,
			subjectsPage: resolve('/subjects'),
			documentation: '/llms.txt'
		})
	});

	void registerTool({
		name: 'open_subjects_page',
		description: 'Navigate the user to the AP subject picker.',
		inputSchema: {
			type: 'object',
			properties: {},
			additionalProperties: false
		},
		execute: async () => {
			await goto(resolve('/subjects'));
			return { navigatedTo: resolve('/subjects') };
		}
	});

	void registerTool({
		name: 'open_summer_guide',
		description: 'Navigate the user to the summer AP study planning guide.',
		inputSchema: {
			type: 'object',
			properties: {},
			additionalProperties: false
		},
		execute: async () => {
			await goto(resolve('/summer'));
			return { navigatedTo: resolve('/summer') };
		}
	});
}
