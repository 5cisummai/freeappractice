import { neon } from '@neondatabase/serverless';
import { PGVector, VectorStoreFactory } from 'mem0ai/oss';

type PgVectorConfig = ConstructorParameters<typeof PGVector>[0];

/** Mem0's pgvector SQL works over Neon HTTP without keeping a pg.Client alive. */
export class NeonHttpPGVector extends PGVector {
	override initialize(): Promise<void> {
		const config = (this as unknown as { config: PgVectorConfig }).config;
		const sql = neon(config.connectionString!, { fullResults: true });
		// PGVector calls initialize() in its constructor, so replace its client before it connects.
		Object.assign(this, {
			client: {
				connect: async () => {},
				query: (text: string, params?: unknown[]) => sql.query(text, params),
				end: async () => {}
			}
		});
		return super.initialize();
	}
}

let installed = false;

export function installNeonHttpPGVector(): void {
	if (installed) return;
	const create = VectorStoreFactory.create;
	VectorStoreFactory.create = (provider, config) =>
		provider.toLowerCase() === 'pgvector' && config.transport === 'neon-http'
			? new NeonHttpPGVector(config as PgVectorConfig)
			: create(provider, config);
	installed = true;
}
