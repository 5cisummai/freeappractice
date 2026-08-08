import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	lte,
	ne,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';

type AnyTable = Record<string, unknown>;
type AnyColumns = Record<string, any>;
export type SortSpec = Record<string, 1 | -1>;
export type Projection = Record<string, 0 | 1> | string;

// These names describe the small legacy query vocabulary still accepted by
// domain callers during the cutover. They are translated to Drizzle SQL
// immediately; this file never imports or connects to MongoDB.
export type MongoFilter = Record<string, unknown>;
export type MongoUpdate = {
	$set?: Record<string, unknown>;
	$setOnInsert?: Record<string, unknown>;
	$inc?: Record<string, number>;
	$max?: Record<string, number>;
	$unset?: Record<string, unknown>;
	$push?: Record<string, unknown>;
};

export type WriteResult = {
	acknowledged: true;
	matchedCount: number;
	modifiedCount: number;
	deletedCount: number;
	upsertedCount: number;
	upsertedId?: string;
};

type QueryOptions = {
	projection?: Projection;
	sort?: SortSpec;
	limit?: number;
	skip?: number;
};

type ModelConfig<T> = {
	table: AnyTable;
	columns: AnyColumns;
	idField: string;
	fieldAliases?: Record<string, string>;
	fromRow?: (row: Record<string, unknown>) => T;
	toRow?: (input: Record<string, unknown>) => Record<string, unknown>;
	prepareInsert?: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
	prepareUpdate?: (
		update: MongoUpdate,
		filter: MongoFilter,
		current: Record<string, unknown> | null
	) => Promise<MongoUpdate>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
	);
}

function fieldName(config: ModelConfig<unknown>, field: string): string {
	if (field === '_id') return config.idField;
	return config.fieldAliases?.[field] ?? field;
}

function columnFor(config: ModelConfig<unknown>, field: string): any {
	return config.columns[fieldName(config, field)];
}

function conditionFor(
	config: ModelConfig<unknown>,
	field: string,
	value: unknown
): SQL | undefined {
	const column = columnFor(config, field);
	if (!column) throw new Error(`Unsupported PostgreSQL model field: ${field}`);

	if (isPlainObject(value)) {
		const parts: SQL[] = [];
		for (const [operator, operand] of Object.entries(value)) {
			switch (operator) {
				case '$eq':
					parts.push(eq(column, operand));
					break;
				case '$ne':
					parts.push(operand === null ? isNotNull(column) : ne(column, operand));
					break;
				case '$lt':
					parts.push(lt(column, operand));
					break;
				case '$lte':
					parts.push(lte(column, operand));
					break;
				case '$gt':
					parts.push(gt(column, operand));
					break;
				case '$gte':
					parts.push(gte(column, operand));
					break;
				case '$in': {
					const values = Array.isArray(operand) ? operand : [];
					parts.push(values.length ? inArray(column, values) : sql`false`);
					break;
				}
				case '$nin': {
					const values = Array.isArray(operand) ? operand : [];
					parts.push(values.length ? sql`NOT (${inArray(column, values)})` : sql`true`);
					break;
				}
				case '$exists':
					parts.push(operand ? isNotNull(column) : isNull(column));
					break;
				default:
					throw new Error(`Unsupported PostgreSQL model operator: ${operator}`);
			}
		}
		return parts.length === 1 ? parts[0] : and(...parts);
	}

	return value === null ? isNull(column) : eq(column, value);
}

function filterFor(config: ModelConfig<unknown>, filter: MongoFilter): SQL | undefined {
	const parts: SQL[] = [];
	for (const [field, value] of Object.entries(filter)) {
		if (field === '$or') {
			const values = Array.isArray(value) ? value : [];
			const nested = values
				.map((item) => (isPlainObject(item) ? filterFor(config, item) : undefined))
				.filter((item): item is SQL => Boolean(item));
			if (nested.length) parts.push(or(...nested) as SQL);
			continue;
		}
		if (field === '$and') {
			const values = Array.isArray(value) ? value : [];
			const nested = values
				.map((item) => (isPlainObject(item) ? filterFor(config, item) : undefined))
				.filter((item): item is SQL => Boolean(item));
			if (nested.length) parts.push(and(...nested) as SQL);
			continue;
		}
		const condition = conditionFor(config, field, value);
		if (condition) parts.push(condition);
	}
	return parts.length === 1 ? parts[0] : parts.length > 1 ? and(...parts) : undefined;
}

export function applyProjection<T>(value: T, projection?: Projection): T {
	if (!projection || !value || typeof value !== 'object') return value;
	if (Array.isArray(value)) return value.map((item) => applyProjection(item, projection)) as T;

	const source = value as Record<string, unknown>;
	if (typeof projection === 'string') {
		const fields = projection.split(/\s+/).filter(Boolean);
		const result: Record<string, unknown> = {};
		for (const field of fields) {
			const projected = readPath(source, field);
			if (projected !== undefined) writePath(result, field, projected);
		}
		if ('_id' in source) result._id = source._id;
		return result as T;
	}

	const included = Object.entries(projection)
		.filter(([, include]) => include === 1)
		.map(([key]) => key);
	if (included.length) {
		const result: Record<string, unknown> = {};
		for (const field of included) {
			const projected = readPath(source, field);
			if (projected !== undefined) writePath(result, field, projected);
		}
		if (projection._id !== 0 && '_id' in source) result._id = source._id;
		return result as T;
	}

	const result = { ...source };
	for (const [field, include] of Object.entries(projection)) {
		if (include === 0) deletePath(result, field);
	}
	return result as T;
}

function normalizeSort(config: ModelConfig<unknown>, sort?: SortSpec): Array<SQL> {
	if (!sort) return [];
	return Object.entries(sort).map(([field, direction]) => {
		const column = columnFor(config, field);
		if (!column) throw new Error(`Unsupported PostgreSQL model sort field: ${field}`);
		return direction === -1 ? desc(column) : asc(column);
	});
}

function addId<T extends Record<string, unknown>>(config: ModelConfig<unknown>, row: T): T {
	const id = row[config.idField];
	if ((row as Record<string, unknown>)._id === undefined && id !== undefined) {
		(row as Record<string, unknown>)._id = id;
	}
	if ((row as Record<string, unknown>).id === undefined && id !== undefined) {
		(row as Record<string, unknown>).id = id;
	}
	return row;
}

function inputValues<T>(
	config: ModelConfig<T>,
	input: Record<string, unknown>
): Record<string, unknown> {
	const row: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (key === '_id' || key === 'save' || key === 'then') continue;
		const target = key === '_id' ? config.idField : key;
		if (config.columns[target] && value !== undefined) row[target] = value;
	}
	const mapped = config.toRow ? config.toRow(row) : row;
	return mapped;
}

function readPath(value: unknown, path: string): unknown {
	return path.split('.').reduce<unknown>((current, key) => {
		if (!current || typeof current !== 'object') return undefined;
		return (current as Record<string, unknown>)[key];
	}, value);
}

function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
	const parts = path.split('.');
	let current = target;
	for (const part of parts.slice(0, -1)) {
		const next = current[part];
		if (!next || typeof next !== 'object' || Array.isArray(next)) current[part] = {};
		current = current[part] as Record<string, unknown>;
	}
	current[parts.at(-1)!] = value;
}

function deletePath(target: Record<string, unknown>, path: string): void {
	const parts = path.split('.');
	let current: Record<string, unknown> | undefined = target;
	for (const part of parts.slice(0, -1)) {
		if (!current) return;
		const next: unknown = current[part];
		if (!next || typeof next !== 'object' || Array.isArray(next)) return;
		const copied: Record<string, unknown> = { ...(next as Record<string, unknown>) };
		current[part] = copied;
		current = copied;
	}
	if (current) delete current[parts.at(-1)!];
}

function updateObject(update: MongoUpdate | Record<string, unknown>): MongoUpdate {
	if (Object.keys(update).some((key) => key.startsWith('$'))) return update as MongoUpdate;
	return { $set: update };
}

export class PostgresQuery<T> implements PromiseLike<T> {
	private readonly options: QueryOptions;
	private result: Promise<T> | null = null;

	constructor(
		private readonly executeQuery: (options: QueryOptions) => Promise<T>,
		options: QueryOptions = {}
	) {
		this.options = { ...options };
	}

	readonly [Symbol.toStringTag] = 'Promise';

	select(projection: Projection): this {
		this.options.projection = projection;
		return this;
	}

	sort(sort: SortSpec): this {
		this.options.sort = sort;
		return this;
	}

	limit(limit: number): this {
		this.options.limit = limit;
		return this;
	}

	skip(skip: number): this {
		this.options.skip = skip;
		return this;
	}

	lean(): this {
		return this;
	}

	exec(): Promise<T> {
		return this.run();
	}

	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
	): Promise<TResult1 | TResult2> {
		return this.run().then(onfulfilled, onrejected);
	}

	catch<TResult = never>(
		onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
	): Promise<T | TResult> {
		return this.run().catch(onrejected);
	}

	finally(onfinally?: (() => void) | null): Promise<T> {
		return this.run().finally(onfinally);
	}

	private run(): Promise<T> {
		this.result ??= this.executeQuery(this.options);
		return this.result;
	}
}

export class PostgresWriteQuery<T> implements PromiseLike<T> {
	constructor(private readonly promise: Promise<T>) {}

	exec(): Promise<T> {
		return this.promise;
	}

	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
	): Promise<TResult1 | TResult2> {
		return this.promise.then(onfulfilled, onrejected);
	}
}

export class PostgresModel<T extends Record<string, any>> {
	private readonly config: ModelConfig<T>;

	constructor(config: ModelConfig<T>) {
		this.config = config;
	}

	private db(): any {
		return getNeonDatabase() as any;
	}

	private rowToDocument(row: Record<string, unknown>): T {
		const mapped = this.config.fromRow ? this.config.fromRow(row) : (row as T);
		const document = addId(this.config, mapped as T & Record<string, unknown>);
		Object.defineProperty(document, 'save', {
			configurable: true,
			enumerable: false,
			value: async () => {
				await this.updateOne({ _id: document._id }, { $set: document });
				return document;
			}
		});
		Object.defineProperty(document, 'deleteOne', {
			configurable: true,
			enumerable: false,
			value: async () => this.deleteOne({ _id: document._id }).exec()
		});
		return document;
	}

	private async queryMany(filter: MongoFilter, options: QueryOptions): Promise<T[]> {
		let query: any = this.db().select().from(this.config.table);
		const where = filterFor(this.config, filter);
		if (where) query = query.where(where);
		const ordering = normalizeSort(this.config, options.sort);
		if (ordering.length) query = query.orderBy(...ordering);
		if (options.skip !== undefined) query = query.offset(options.skip);
		if (options.limit !== undefined) query = query.limit(options.limit);
		const rows = (await query) as Record<string, unknown>[];
		return rows.map((row) => applyProjection(this.rowToDocument(row), options.projection));
	}

	find(
		filter: MongoFilter = {},
		projection?: Projection | null,
		options?: { sort?: SortSpec; limit?: number }
	): PostgresQuery<T[]> {
		return new PostgresQuery((queryOptions) =>
			this.queryMany(filter, {
				...queryOptions,
				projection: queryOptions.projection ?? projection ?? undefined,
				sort: queryOptions.sort ?? options?.sort,
				limit: queryOptions.limit ?? options?.limit
			})
		);
	}

	findOne(
		filter: MongoFilter = {},
		projection?: Projection | null,
		options?: { sort?: SortSpec }
	): PostgresQuery<T | null> {
		return new PostgresQuery(async (queryOptions) => {
			const rows = await this.queryMany(filter, {
				...queryOptions,
				projection: queryOptions.projection ?? projection ?? undefined,
				sort: queryOptions.sort ?? options?.sort,
				limit: 1
			});
			return rows[0] ?? null;
		});
	}

	findById(id: string): PostgresQuery<T | null> {
		return this.findOne({ _id: id });
	}

	exists(filter: MongoFilter = {}): PostgresQuery<{ _id: unknown } | null> {
		return new PostgresQuery(async () => {
			const row = await this.findOne(filter, { _id: 1 }).exec();
			return row ? { _id: row._id } : null;
		});
	}

	countDocuments(filter: MongoFilter = {}): PostgresQuery<number> {
		return new PostgresQuery(async () => (await this.find(filter).exec()).length);
	}

	distinct(field: string, filter: MongoFilter = {}): PostgresQuery<unknown[]> {
		return new PostgresQuery(async () => {
			const rows = await this.find(filter).exec();
			return [...new Set(rows.map((row) => row[field]))];
		});
	}

	aggregate<R = Record<string, unknown>>(pipeline: unknown[]): PostgresQuery<R[]> {
		return new PostgresQuery(async () => {
			const first = pipeline[0] as { $match?: MongoFilter } | undefined;
			let rows: Array<Record<string, unknown>> = (await this.find(
				first?.$match ?? {}
			).exec()) as Array<Record<string, unknown>>;
			for (const stage of pipeline.slice(first?.$match ? 1 : 0) as Array<Record<string, any>>) {
				if (stage.$group) {
					const spec = stage.$group as Record<string, any>;
					const groups = new Map<string, Record<string, unknown>>();
					for (const row of rows) {
						const idSpec = spec._id;
						const idValue =
							idSpec && typeof idSpec === 'object'
								? Object.fromEntries(
										Object.entries(idSpec).map(([key, path]) => [
											key,
											readPath(row, String(path).replace(/^\$/, ''))
										])
									)
								: typeof idSpec === 'string' && idSpec.startsWith('$')
									? readPath(row, idSpec.slice(1))
									: idSpec;
						const key = JSON.stringify(idValue);
						const group = (groups.get(key) ?? { _id: idValue }) as Record<string, unknown>;
						for (const [name, operation] of Object.entries(spec)) {
							if (name === '_id') continue;
							if ('$sum' in operation) {
								const operand = operation.$sum;
								const amount =
									operand === 1
										? 1
										: Number(readPath(row, String(operand).replace(/^\$/, '')) ?? 0);
								group[name] = Number(group[name] ?? 0) + amount;
							} else if ('$min' in operation || '$max' in operation) {
								const operand = operation.$min ?? operation.$max;
								const value = readPath(row, String(operand).replace(/^\$/, ''));
								const current = group[name];
								if (
									current === undefined ||
									('$min' in operation
										? String(value) < String(current)
										: String(value) > String(current))
								)
									group[name] = value;
							} else if ('$addToSet' in operation) {
								const value =
									operation.$addToSet === '$$ROOT'
										? row
										: readPath(row, String(operation.$addToSet).replace(/^\$/, ''));
								const set = (group[name] as unknown[] | undefined) ?? [];
								if (!set.some((item) => JSON.stringify(item) === JSON.stringify(value)))
									set.push(value);
								group[name] = set;
							}
						}
						groups.set(key, group);
					}
					rows = [...groups.values()];
				} else if (stage.$sort) {
					const sort = stage.$sort as SortSpec;
					rows.sort((a, b) => {
						for (const [field, direction] of Object.entries(sort)) {
							const left = readPath(a, field);
							const right = readPath(b, field);
							if (left === right) continue;
							return (String(left) < String(right) ? -1 : 1) * direction;
						}
						return 0;
					});
				} else if (stage.$limit) {
					rows = rows.slice(0, stage.$limit);
				}
			}
			return rows as R[];
		});
	}

	async create(input: Record<string, unknown>): Promise<T> {
		const prepared = this.config.prepareInsert ? await this.config.prepareInsert(input) : input;
		const values = inputValues(this.config, prepared);
		const rows = (await (this.db()
			.insert(this.config.table)
			.values(values)
			.returning() as any)) as Record<string, unknown>[];
		if (!rows[0]) throw new Error('PostgreSQL insert returned no row');
		return this.rowToDocument(rows[0]);
	}

	private updateValues(
		update: MongoUpdate,
		current: Record<string, unknown> | null
	): Record<string, unknown> {
		const values: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(update.$set ?? {})) {
			const field = fieldName(this.config, key);
			if (this.config.columns[field]) values[field] = value;
		}
		for (const [key] of Object.entries(update.$unset ?? {})) {
			if (this.config.columns[key]) values[key] = null;
		}
		for (const [key, value] of Object.entries(update.$inc ?? {})) {
			const column = this.config.columns[key];
			if (column) values[key] = sql`${column} + ${value}`;
		}
		for (const [key, value] of Object.entries(update.$max ?? {})) {
			const column = this.config.columns[key];
			if (column) values[key] = sql`GREATEST(${column}, ${value})`;
		}
		for (const [key, value] of Object.entries(update.$push ?? {})) {
			const column = this.config.columns[key];
			if (column) {
				const previous = current?.[key];
				values[key] = [...(Array.isArray(previous) ? previous : []), value];
			}
		}
		return values;
	}

	private async applyUpdate(
		filter: MongoFilter,
		updateInput: MongoUpdate | Record<string, unknown>,
		options: { upsert?: boolean; returnDocument?: 'before' | 'after'; new?: boolean } = {}
	): Promise<T | null> {
		const current = await this.findOne(filter).exec();
		let update = updateObject(updateInput);
		if (this.config.prepareUpdate)
			update = await this.config.prepareUpdate(update, filter, current);

		if (!current && options.upsert) {
			const base: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(filter)) {
				if (!key.startsWith('$') && !isPlainObject(value))
					base[key === '_id' ? this.config.idField : key] = value;
			}
			Object.assign(base, update.$setOnInsert ?? {}, update.$set ?? {});
			for (const [key, value] of Object.entries(update.$inc ?? {})) base[key] = value;
			return this.create(base);
		}
		if (!current) return null;

		const values = this.updateValues(update, current);
		if (!Object.keys(values).length) return current;
		if (this.config.columns.updatedAt) values.updatedAt = new Date();
		const where = filterFor(this.config, filter);
		const result = (await (this.db()
			.update(this.config.table)
			.set(values)
			.where(where)
			.returning() as any)) as Record<string, unknown>[];
		const row = result[0] ?? null;
		if (!row) return null;
		return options.returnDocument === 'before' && !options.new ? current : this.rowToDocument(row);
	}

	updateOne(
		filter: MongoFilter,
		update: MongoUpdate | Record<string, unknown>,
		options: {
			upsert?: boolean;
			returnDocument?: 'before' | 'after';
			new?: boolean;
			setDefaultsOnInsert?: boolean;
		} = {}
	): PostgresWriteQuery<WriteResult> {
		return new PostgresWriteQuery(
			(async () => {
				const current = await this.findOne(filter).exec();
				const updated = await this.applyUpdate(filter, update, options);
				return {
					acknowledged: true,
					matchedCount: current ? 1 : 0,
					modifiedCount: updated && current ? 1 : 0,
					deletedCount: 0,
					upsertedCount: !current && options.upsert && updated ? 1 : 0,
					upsertedId: !current && options.upsert ? updated?._id : undefined
				};
			})()
		);
	}

	updateMany(
		filter: MongoFilter,
		update: MongoUpdate | Record<string, unknown>,
		_options: Record<string, unknown> = {}
	): PostgresWriteQuery<WriteResult> {
		void _options;
		return new PostgresWriteQuery(
			(async () => {
				const rows = await this.find(filter).exec();
				for (const row of rows) await this.applyUpdate({ _id: row._id }, update);
				return {
					acknowledged: true,
					matchedCount: rows.length,
					modifiedCount: rows.length,
					deletedCount: 0,
					upsertedCount: 0
				};
			})()
		);
	}

	findOneAndUpdate(
		filter: MongoFilter,
		update: MongoUpdate | Record<string, unknown>,
		options: {
			upsert?: boolean;
			returnDocument?: 'before' | 'after';
			new?: boolean;
			setDefaultsOnInsert?: boolean;
		} = {}
	): PostgresQuery<T | null> {
		return new PostgresQuery(() => this.applyUpdate(filter, update, options));
	}

	deleteOne(filter: MongoFilter): PostgresWriteQuery<WriteResult> {
		return new PostgresWriteQuery(
			(async () => {
				const where = filterFor(this.config, filter);
				const result = (await (this.db()
					.delete(this.config.table)
					.where(where)
					.returning() as any)) as Record<string, unknown>[];
				return {
					acknowledged: true,
					matchedCount: result.length ? 1 : 0,
					modifiedCount: 0,
					deletedCount: result.length,
					upsertedCount: 0
				};
			})()
		);
	}

	deleteMany(filter: MongoFilter): PostgresWriteQuery<WriteResult> {
		return new PostgresWriteQuery(
			(async () => {
				const where = filterFor(this.config, filter);
				const result = (await (this.db()
					.delete(this.config.table)
					.where(where)
					.returning() as any)) as Record<string, unknown>[];
				return {
					acknowledged: true,
					matchedCount: result.length,
					modifiedCount: 0,
					deletedCount: result.length,
					upsertedCount: 0
				};
			})()
		);
	}

	async bulkWrite(
		operations: Array<{
			updateOne: {
				filter: MongoFilter;
				update: MongoUpdate | Record<string, unknown>;
				upsert?: boolean;
			};
		}>,
		_options: Record<string, unknown> = {}
	): Promise<WriteResult> {
		void _options;
		let matchedCount = 0;
		let modifiedCount = 0;
		let upsertedCount = 0;
		for (const operation of operations) {
			const before = await this.findOne(operation.updateOne.filter).exec();
			const result = await this.updateOne(operation.updateOne.filter, operation.updateOne.update, {
				upsert: operation.updateOne.upsert
			}).exec();
			matchedCount += result.matchedCount;
			modifiedCount += result.modifiedCount;
			upsertedCount += result.upsertedCount;
			void before;
		}
		return { acknowledged: true, matchedCount, modifiedCount, deletedCount: 0, upsertedCount };
	}
}

export function model<T extends Record<string, any>>(config: ModelConfig<T>): PostgresModel<T> {
	return new PostgresModel(config);
}
