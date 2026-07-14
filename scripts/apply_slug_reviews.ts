import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { SLUG_ENTITY_TYPES, type SlugEntityType } from './generate_slug_candidates';

export type SlugStoreEntity = {
	id: string;
	slug: string | null;
};

export type SlugStoreEvent = {
	id: string;
	eventDate: string;
	venueId: string;
	slug: string | null;
};

export type SlugReviewDecision = {
	entityType: SlugEntityType;
	id: string;
	status: 'approved' | 'rejected';
	slug: string | null;
};

export type SlugReviewRedirect = {
	entityType: SlugEntityType;
	id: string;
	from: string;
	to: string;
};

export type SlugReviewArtifact = {
	schemaVersion: 1;
	sourceCandidateArtifact: string;
	decisions: readonly SlugReviewDecision[];
	redirects?: readonly SlugReviewRedirect[];
};

export type SlugApplyDiagnostic = {
	code: 'EVENT_VENUE_SLUG_MISSING';
	eventId: string;
	venueId: string;
};

export type SlugApplyResult = {
	updatedEntitySlugs: number;
	updatedEventSlugs: number;
	rejected: number;
	diagnostics: SlugApplyDiagnostic[];
	redirects: SlugReviewRedirect[];
};

type SlugReviewErrorCode =
	| 'SLUG_INVALID'
	| 'SLUG_CONFLICT'
	| 'SLUG_NOT_FOUND'
	| 'SLUG_REVIEW_INVALID'
	| 'SLUG_REDIRECT_DUPLICATE'
	| 'SLUG_REDIRECT_CHAIN'
	| 'SLUG_REDIRECT_SOURCE_CONFLICT'
	| 'SLUG_REDIRECT_TARGET_MISMATCH';

export class SlugReviewError extends Error {
	constructor(
		readonly code: SlugReviewErrorCode,
		message: string,
	) {
		super(message);
	}
}

export interface SlugPersistenceStore {
	transaction<T>(callback: (store: SlugPersistenceStore) => Promise<T>): Promise<T>;
	listEntities(entityType: SlugEntityType): Promise<SlugStoreEntity[]>;
	listEvents(): Promise<SlugStoreEvent[]>;
	setEntitySlug(entityType: SlugEntityType, id: string, slug: string): Promise<void>;
	setEventSlug(id: string, slug: string): Promise<void>;
}

type InMemorySlugStore = SlugPersistenceStore & {
	readEntity(entityType: SlugEntityType, id: string): Promise<SlugStoreEntity | undefined>;
	readEvent(id: string): Promise<SlugStoreEvent | undefined>;
};

type InMemoryState = {
	entities: Record<SlugEntityType, SlugStoreEntity[]>;
	events: SlugStoreEvent[];
};

const ENTITY_TABLES: Record<SlugEntityType, string> = {
	project: 'project',
	person: 'person',
	composition: 'composition',
	work: 'work',
	venue: 'venue',
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export async function applySlugReviews(store: SlugPersistenceStore, artifact: SlugReviewArtifact): Promise<SlugApplyResult> {
	validateReviewArtifact(artifact);

	return await store.transaction(async (transaction) => {
		const entities = new Map<SlugEntityType, Map<string, SlugStoreEntity>>();
		for (const entityType of SLUG_ENTITY_TYPES) {
			entities.set(entityType, new Map((await transaction.listEntities(entityType)).map((row) => [row.id, { ...row }])));
		}

		const seenDecisions = new Set<string>();
		const approvedSlugs = new Map<SlugEntityType, Map<string, string>>();
		let rejected = 0;
		for (const decision of artifact.decisions) {
			const decisionKey = `${decision.entityType}:${decision.id}`;
			if (seenDecisions.has(decisionKey)) {
				throw new SlugReviewError('SLUG_REVIEW_INVALID', `Duplicate review decision: ${decisionKey}`);
			}
			seenDecisions.add(decisionKey);

			const row = entities.get(decision.entityType)?.get(decision.id);
			if (!row) throw new SlugReviewError('SLUG_NOT_FOUND', `Slug target was not found: ${decisionKey}`);
			if (decision.status === 'rejected') {
				rejected += 1;
				continue;
			}

			const slug = decision.slug;
			if (!slug || !SLUG_PATTERN.test(slug)) {
				throw new SlugReviewError('SLUG_INVALID', `Approved slug is invalid: ${decisionKey}`);
			}

			const byEntityType = approvedSlugs.get(decision.entityType) ?? new Map<string, string>();
			if ([...byEntityType.values()].includes(slug)) {
				throw new SlugReviewError('SLUG_CONFLICT', `Approved slugs conflict within ${decision.entityType}: ${slug}`);
			}
			const occupied = [...entities.get(decision.entityType)!.values()].some((candidate) => candidate.id !== decision.id && candidate.slug === slug);
			if (occupied) throw new SlugReviewError('SLUG_CONFLICT', `Slug is already used within ${decision.entityType}: ${slug}`);
			byEntityType.set(decision.id, slug);
			approvedSlugs.set(decision.entityType, byEntityType);
		}

		const redirects = validateRedirects(artifact.redirects ?? [], entities, approvedSlugs);
		let updatedEntitySlugs = 0;
		for (const [entityType, decisions] of approvedSlugs) {
			for (const [id, slug] of decisions) {
				const row = entities.get(entityType)!.get(id)!;
				if (row.slug === slug) continue;
				await transaction.setEntitySlug(entityType, id, slug);
				row.slug = slug;
				updatedEntitySlugs += 1;
			}
		}

		const venues = entities.get('venue')!;
		const events = (await transaction.listEvents()).map((event) => ({ ...event }));
		let updatedEventSlugs = 0;
		const eventAssignments = deriveEventSlugs(events, venues);
		for (const assignment of eventAssignments.assignments) {
			await transaction.setEventSlug(assignment.eventId, assignment.slug);
			updatedEventSlugs += 1;
		}

		return {
			updatedEntitySlugs,
			updatedEventSlugs,
			rejected,
			diagnostics: eventAssignments.diagnostics,
			redirects,
		};
	});
}

export function deriveEventSlugs(
	events: readonly SlugStoreEvent[],
	venues: ReadonlyMap<string, SlugStoreEntity>,
): {
	assignments: Array<{ eventId: string; slug: string }>;
	diagnostics: SlugApplyDiagnostic[];
} {
	const occupied = new Set(events.flatMap((event) => (event.slug ? [event.slug] : [])));
	const assignments: Array<{ eventId: string; slug: string }> = [];
	const diagnostics: SlugApplyDiagnostic[] = [];

	for (const event of [...events].filter((candidate) => candidate.slug === null).sort((left, right) => left.id.localeCompare(right.id))) {
		const venueSlug = venues.get(event.venueId)?.slug;
		if (!venueSlug) {
			diagnostics.push({ code: 'EVENT_VENUE_SLUG_MISSING', eventId: event.id, venueId: event.venueId });
			continue;
		}

		const baseSlug = `${event.eventDate}-${venueSlug}`;
		let suffix = 1;
		let slug = baseSlug;
		while (occupied.has(slug)) {
			suffix += 1;
			slug = `${baseSlug}-${suffix}`;
		}
		occupied.add(slug);
		assignments.push({ eventId: event.id, slug });
	}

	return { assignments, diagnostics };
}

export function validateReviewArtifact(value: unknown): asserts value is SlugReviewArtifact {
	if (typeof value !== 'object' || value === null) throw new SlugReviewError('SLUG_REVIEW_INVALID', 'Slug review artifact must be an object');
	const artifact = value as Partial<SlugReviewArtifact>;
	if (artifact.schemaVersion !== 1 || typeof artifact.sourceCandidateArtifact !== 'string' || !Array.isArray(artifact.decisions)) {
		throw new SlugReviewError('SLUG_REVIEW_INVALID', 'Slug review artifact has an unsupported shape');
	}
	for (const decision of artifact.decisions) {
		if (
			typeof decision !== 'object' ||
			decision === null ||
			!SLUG_ENTITY_TYPES.includes((decision as SlugReviewDecision).entityType) ||
			typeof (decision as SlugReviewDecision).id !== 'string' ||
			!['approved', 'rejected'].includes((decision as SlugReviewDecision).status) ||
			!((decision as SlugReviewDecision).slug === null || typeof (decision as SlugReviewDecision).slug === 'string')
		) {
			throw new SlugReviewError('SLUG_REVIEW_INVALID', 'Slug review decision has an unsupported shape');
		}
	}
	if (artifact.redirects !== undefined && !Array.isArray(artifact.redirects)) {
		throw new SlugReviewError('SLUG_REVIEW_INVALID', 'Slug review redirects must be an array');
	}
	for (const redirect of artifact.redirects ?? []) {
		if (
			typeof redirect !== 'object' ||
			redirect === null ||
			!SLUG_ENTITY_TYPES.includes((redirect as SlugReviewRedirect).entityType) ||
			typeof (redirect as SlugReviewRedirect).id !== 'string' ||
			typeof (redirect as SlugReviewRedirect).from !== 'string' ||
			typeof (redirect as SlugReviewRedirect).to !== 'string'
		) {
			throw new SlugReviewError('SLUG_REVIEW_INVALID', 'Slug review redirect has an unsupported shape');
		}
	}
}

function validateRedirects(
	redirects: readonly SlugReviewRedirect[],
	entities: ReadonlyMap<SlugEntityType, ReadonlyMap<string, SlugStoreEntity>>,
	approvedSlugs: ReadonlyMap<SlugEntityType, ReadonlyMap<string, string>>,
): SlugReviewRedirect[] {
	const seenFrom = new Set<string>();
	const fromByEntityType = new Map<SlugEntityType, Set<string>>();
	const validated: SlugReviewRedirect[] = [];

	for (const redirect of redirects) {
		const row = entities.get(redirect.entityType)?.get(redirect.id);
		if (!row) throw new SlugReviewError('SLUG_NOT_FOUND', `Redirect target was not found: ${redirect.entityType}:${redirect.id}`);
		if (!SLUG_PATTERN.test(redirect.from) || !SLUG_PATTERN.test(redirect.to) || redirect.from === redirect.to) {
			throw new SlugReviewError('SLUG_INVALID', `Redirect slug is invalid: ${redirect.entityType}:${redirect.id}`);
		}

		const key = `${redirect.entityType}:${redirect.from}`;
		if (seenFrom.has(key)) throw new SlugReviewError('SLUG_REDIRECT_DUPLICATE', `Redirect source is reused: ${key}`);
		seenFrom.add(key);

		const resolvedTarget = approvedSlugs.get(redirect.entityType)?.get(redirect.id) ?? row.slug;
		if (resolvedTarget !== redirect.to) {
			throw new SlugReviewError('SLUG_REDIRECT_TARGET_MISMATCH', `Redirect target does not match the published slug: ${key}`);
		}

		const froms = fromByEntityType.get(redirect.entityType) ?? new Set<string>();
		froms.add(redirect.from);
		fromByEntityType.set(redirect.entityType, froms);
		validated.push({ ...redirect });
	}

	for (const redirect of validated) {
		if (fromByEntityType.get(redirect.entityType)?.has(redirect.to)) {
			throw new SlugReviewError('SLUG_REDIRECT_CHAIN', `Redirect chain is not allowed: ${redirect.from} -> ${redirect.to}`);
		}
	}

	for (const redirect of validated) {
		const occupiedByOther = [...entities.get(redirect.entityType)!.values()].some((candidate) => candidate.id !== redirect.id && candidate.slug === redirect.from);
		if (occupiedByOther) throw new SlugReviewError('SLUG_REDIRECT_SOURCE_CONFLICT', `Redirect source is still published: ${redirect.entityType}:${redirect.from}`);
	}

	return validated.sort((left, right) => `${left.entityType}:${left.from}`.localeCompare(`${right.entityType}:${right.from}`));
}

export function createInMemorySlugStore(initial: InMemoryState): InMemorySlugStore {
	let state = cloneState(initial);

	const createStore = (readState: () => InMemoryState): SlugPersistenceStore => {
		const store: SlugPersistenceStore = {
			transaction: async (callback) => {
				const transactionState = cloneState(readState());
				const result = await callback(createStore(() => transactionState));
				state = transactionState;
				return result;
			},
			listEntities: async (entityType) => readState().entities[entityType].map((row) => ({ ...row })),
			listEvents: async () => readState().events.map((event) => ({ ...event })),
			setEntitySlug: async (entityType, id, slug) => {
				const row = readState().entities[entityType].find((candidate) => candidate.id === id);
				if (!row) throw new SlugReviewError('SLUG_NOT_FOUND', `Slug target was not found: ${entityType}:${id}`);
				row.slug = slug;
			},
			setEventSlug: async (id, slug) => {
				const event = readState().events.find((candidate) => candidate.id === id);
				if (!event) throw new SlugReviewError('SLUG_NOT_FOUND', `Event target was not found: ${id}`);
				event.slug = slug;
			},
		};
		return store;
	};

	const store = createStore(() => state) as InMemorySlugStore;
	store.readEntity = async (entityType, id) => state.entities[entityType].find((row) => row.id === id);
	store.readEvent = async (id) => state.events.find((event) => event.id === id);
	return store;
}

export function createPostgresSlugStore(pool: Pool): SlugPersistenceStore {
	const createQueryStore = (query: Query): SlugPersistenceStore => {
		const store: SlugPersistenceStore = {
			transaction: async (callback) => callback(store),
			listEntities: async (entityType) => {
				const result = await query(`SELECT id::text, slug FROM "${ENTITY_TABLES[entityType]}" ORDER BY id`, []);
				return result.rows as SlugStoreEntity[];
			},
			listEvents: async () => {
				const result = await query('SELECT id::text, event_date::text AS "eventDate", venue_id::text AS "venueId", slug FROM "event" ORDER BY id', []);
				return result.rows as SlugStoreEvent[];
			},
			setEntitySlug: async (entityType, id, slug) => {
				await query(`UPDATE "${ENTITY_TABLES[entityType]}" SET slug = $1 WHERE id = $2`, [slug, id]);
			},
			setEventSlug: async (id, slug) => {
				await query('UPDATE "event" SET slug = $1 WHERE id = $2', [slug, id]);
			},
		};
		return store;
	};

	return {
		...createQueryStore(async (text, values) => {
			const result = await pool.query(text, values);
			return { rows: result.rows as Array<Record<string, unknown>> };
		}),
		transaction: async (callback) => {
			const client = await pool.connect();
			try {
				await client.query('BEGIN');
				const result = await callback(
					createQueryStore(async (text, values) => {
						const queryResult = await client.query(text, values);
						return { rows: queryResult.rows as Array<Record<string, unknown>> };
					}),
				);
				await client.query('COMMIT');
				return result;
			} catch (error) {
				await client.query('ROLLBACK');
				throw error;
			} finally {
				client.release();
			}
		},
	};
}

type Query = (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

type ParsedArgs = { input: string };

export function parseArgs(argv: string[]): ParsedArgs {
	let input = 'drafts/slugs/slug-reviews.json';
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--input' && argv[index + 1]) {
			input = argv[++index]!;
			continue;
		}
		throw new Error(`Unknown or incomplete argument: ${arg}`);
	}
	return { input };
}

function cloneState(value: InMemoryState): InMemoryState {
	return {
		entities: Object.fromEntries(SLUG_ENTITY_TYPES.map((entityType) => [entityType, value.entities[entityType].map((row) => ({ ...row }))])) as InMemoryState['entities'],
		events: value.events.map((event) => ({ ...event })),
	};
}

async function main(): Promise<void> {
	const { input } = parseArgs(Bun.argv.slice(2));
	const artifact = JSON.parse(await readFile(input, 'utf8')) as unknown;
	validateReviewArtifact(artifact);
	const pool = new Pool({ connectionString: Bun.env.DATABASE_URL ?? 'postgres://monden:monden@localhost:5432/monden' });
	try {
		const result = await applySlugReviews(createPostgresSlugStore(pool), artifact);
		console.log(JSON.stringify(result, null, 2));
	} finally {
		await pool.end();
	}
}

if (import.meta.main) await main();
