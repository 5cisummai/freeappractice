import { index, jsonb, pgTable, uuid, vector } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

function memoryTable(name: string) {
	return pgTable(
		name,
		{
			id: uuid('id').primaryKey(),
			vector: vector('vector', { dimensions: 1536 }),
			payload: jsonb('payload').$type<Record<string, unknown>>()
		},
		(table) => [index(`${name}_user_idx`).on(sql`(${table.payload}->>'user_id')`)]
	);
}

export const tutorMemoryDevelopment = memoryTable('tutor_memory_development');
export const tutorMemoryDevelopmentEntities = memoryTable('tutor_memory_development_entities');
export const tutorMemoryPreview = memoryTable('tutor_memory_preview');
export const tutorMemoryPreviewEntities = memoryTable('tutor_memory_preview_entities');
export const tutorMemoryProduction = memoryTable('tutor_memory_production');
export const tutorMemoryProductionEntities = memoryTable('tutor_memory_production_entities');
