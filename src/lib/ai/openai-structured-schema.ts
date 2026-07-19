import { z } from 'zod';

type JsonSchemaNode = {
	type?: string | string[];
	properties?: Record<string, JsonSchemaNode>;
	required?: string[];
	items?: JsonSchemaNode | JsonSchemaNode[];
	anyOf?: JsonSchemaNode[];
	oneOf?: JsonSchemaNode[];
	allOf?: JsonSchemaNode[];
	$defs?: Record<string, JsonSchemaNode>;
	definitions?: Record<string, JsonSchemaNode>;
};

function isObjectSchema(node: JsonSchemaNode): boolean {
	const t = node.type;
	if (t === 'object') return true;
	if (Array.isArray(t) && t.includes('object')) return true;
	return Boolean(node.properties);
}

/**
 * OpenAI structured outputs require every key in `properties` to also appear in
 * `required`. Zod `.optional()` fields violate that and fail before generation.
 */
export function findOpenAiOptionalPropertyPaths(
	schema: z.ZodType,
	opts?: { schemaName?: string }
): string[] {
	const jsonSchema = z.toJSONSchema(schema) as JsonSchemaNode;
	const issues: string[] = [];
	const rootLabel = opts?.schemaName ?? 'schema';

	function visit(node: JsonSchemaNode, path: string): void {
		if (isObjectSchema(node) && node.properties) {
			const required = new Set(node.required ?? []);
			for (const key of Object.keys(node.properties)) {
				const childPath = path ? `${path}.${key}` : key;
				if (!required.has(key)) {
					issues.push(childPath);
				}
				visit(node.properties[key]!, childPath);
			}
		}

		if (node.items) {
			const items = Array.isArray(node.items) ? node.items : [node.items];
			for (const [i, item] of items.entries()) {
				visit(item, `${path}[${i}]`);
			}
		}

		for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
			const variants = node[key];
			if (!variants) continue;
			for (const [i, variant] of variants.entries()) {
				visit(variant, `${path}/${key}[${i}]`);
			}
		}

		for (const defsKey of ['$defs', 'definitions'] as const) {
			const defs = node[defsKey];
			if (!defs) continue;
			for (const [name, def] of Object.entries(defs)) {
				visit(def, `${path}/${defsKey}/${name}`);
			}
		}
	}

	visit(jsonSchema, rootLabel);
	// Paths are rooted at schema name for clarity; strip the root label prefix for
	// property paths that are relative to the object itself when rootLabel === 'schema'.
	return issues.map((p) => (p.startsWith(`${rootLabel}.`) ? p.slice(rootLabel.length + 1) : p));
}

export function assertOpenAiCompatibleObjectSchema(
	schema: z.ZodType,
	opts?: { schemaName?: string }
): void {
	const missing = findOpenAiOptionalPropertyPaths(schema, opts);
	if (missing.length === 0) return;

	const label = opts?.schemaName ? `'${opts.schemaName}'` : 'structured output schema';
	throw new Error(
		`OpenAI ${label} is invalid: properties missing from required: ${missing.join(', ')}. ` +
			`Use required fields or .nullable() instead of .optional().`
	);
}
