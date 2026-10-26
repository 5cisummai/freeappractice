import { apArtHistoryWorks } from '#lib/server/neon/schema/ap-art-history.js';

type WorkSelect = typeof apArtHistoryWorks.$inferSelect;

export type ApArtHistoryWorkDto = {
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

export function workToDto(row: WorkSelect): ApArtHistoryWorkDto {
	return {
		number: row.number,
		contentArea: row.contentArea,
		titleDesignation: row.titleDesignation,
		artist: row.artist,
		culture: row.culture,
		location: row.location,
		dateOfCreation: row.dateOfCreation,
		materials: row.materials,
		imageSource: row.imageSource,
		collegeBoardSource: row.collegeBoardSource,
		fullIdentifier: row.fullIdentifier,
		imageCount: row.imageCount,
		imageViewNotes: row.imageViewNotes,
		officialImageSetPages: row.officialImageSetPages,
		locationStatus: row.locationStatus,
		identifierNotes: row.identifierNotes
	};
}
