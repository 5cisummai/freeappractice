export type WorkPracticeModel = {
	contentArea: string;
	requestVersion: number;
};

export function createWorkPracticeModel(input: {
	contentArea: string;
	requestVersion: number;
}): WorkPracticeModel {
	return {
		contentArea: input.contentArea,
		requestVersion: input.requestVersion
	};
}
