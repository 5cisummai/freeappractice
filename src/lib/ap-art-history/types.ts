export type ApArtHistoryWorkRow = {
	number: number;
	contentArea: string;
	titleDesignation: string;
	artist: string;
	culture: string;
	location: string;
	dateOfCreation: string;
	materials: string;
	imageSource: string;
	collegeBoardSource: string;
	fullIdentifier: string;
	imageCount: number;
	imageViewNotes: string;
	officialImageSetPages: number[];
	locationStatus: string;
	identifierNotes: string;
};

export type ApArtHistoryWorkListFilters = {
	contentArea?: string;
	locationStatus?: string;
	numberFrom?: number;
	numberTo?: number;
};

export type ApArtHistoryWorkListParams = ApArtHistoryWorkListFilters & {
	page: number;
	limit: number;
};

export type ApArtHistoryContentAreaSummary = {
	contentArea: string;
	count: number;
};
