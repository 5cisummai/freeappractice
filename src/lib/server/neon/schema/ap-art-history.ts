import { index, integer, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './common';

export const apArtHistorySchema = pgSchema('ap_art_history');

export const apArtHistoryWorks = apArtHistorySchema.table(
	'works',
	{
		number: integer('number').primaryKey(),
		contentArea: text('content_area').notNull(),
		titleDesignation: text('title_designation').notNull(),
		artist: text('artist').notNull().default(''),
		culture: text('culture').notNull().default(''),
		location: text('location').notNull().default(''),
		dateOfCreation: text('date_of_creation').notNull(),
		materials: text('materials').notNull(),
		imageSource: text('image_source').notNull(),
		collegeBoardSource: text('college_board_source').notNull(),
		fullIdentifier: text('full_identifier').notNull(),
		imageCount: integer('image_count').notNull(),
		imageViewNotes: text('image_view_notes').notNull().default(''),
		officialImageSetPages: jsonb('official_image_set_pages').$type<number[]>().notNull(),
		locationStatus: text('location_status').notNull(),
		identifierNotes: text('identifier_notes').notNull().default(''),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('ap_art_history_works_content_area_idx').on(table.contentArea),
		index('ap_art_history_works_location_status_idx').on(table.locationStatus)
	]
);

export const apArtHistoryApiHistory = apArtHistorySchema.table(
	'api_history',
	{
		id: text('id').primaryKey(),
		at: timestamp('at', { withTimezone: true, mode: 'date' }).notNull(),
		method: text('method').notNull(),
		path: text('path').notNull(),
		query: text('query'),
		workNumber: integer('work_number'),
		userId: text('user_id'),
		statusCode: integer('status_code').notNull(),
		durationMs: integer('duration_ms'),
		createdAt: createdAt()
	},
	(table) => [
		index('ap_art_history_api_history_at_idx').on(table.at),
		index('ap_art_history_api_history_work_at_idx').on(table.workNumber, table.at),
		index('ap_art_history_api_history_user_at_idx').on(table.userId, table.at)
	]
);
