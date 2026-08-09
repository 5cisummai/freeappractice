import { customType, timestamp } from 'drizzle-orm/pg-core';

export const createdAt = () =>
	timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();

export const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType: () => 'bytea'
});
