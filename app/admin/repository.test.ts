import { describe, expect, test } from 'bun:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { editorConfigs } from '../admin-client/src/resources';
import { adminResources, lookupResources } from './types';
import { createAdminRepository, createRelatedLoaders, joinedResourceDefinitions, lookupDefinitions, resourceTables, simpleResourceDefinitions } from './repository';
import { createCompositionRelatedLoader } from './repository/compositions/load-related';
import { createRecordingRelatedLoader } from './repository/recordings/load-related';

describe('admin repository definitions', () => {
	test('separates persistence tables from read models', () => {
		const readResources = adminResources.filter((resource) => resource !== 'article-mentions');
		expect(Object.keys(resourceTables).sort()).toEqual([...readResources].sort());

		const simpleResources = Object.keys(simpleResourceDefinitions);
		const joinedResources = Object.keys(joinedResourceDefinitions);

		expect(simpleResources.filter((resource) => joinedResources.includes(resource))).toEqual([]);
		expect([...simpleResources, ...joinedResources].sort()).toEqual([...readResources].sort());

		for (const definition of [...Object.values(simpleResourceDefinitions), ...Object.values(joinedResourceDefinitions)]) {
			expect(definition.select['id']).toBeTruthy();
			expect(definition.searchColumns.length).toBeGreaterThan(0);
			expect(definition.sortColumns['id']).toBeTruthy();
			expect(definition.defaultSort).toBeTruthy();
			expect(definition.sortColumns[definition.defaultSort]).toBeTruthy();
		}
	});

	test('defines every lookup with a human-readable label expression', () => {
		expect(Object.keys(lookupDefinitions).sort()).toEqual([...lookupResources].sort());

		for (const resource of lookupResources) {
			const definition = lookupDefinitions[resource];
			expect(definition.table).toBeTruthy();
			expect(definition.id).toBeTruthy();
			expect(definition.label).toBeTruthy();
			expect(definition.searchColumns.length).toBeGreaterThan(0);
		}
	});

	test('main list definitions expose resolved relationship labels', () => {
		expect(joinedResourceDefinitions.works.select['projectName']).toBeTruthy();
		expect(joinedResourceDefinitions.events.select['projectName']).toBeTruthy();
		expect(joinedResourceDefinitions.events.select['venueName']).toBeTruthy();
		expect(joinedResourceDefinitions.contributions.select['personName']).toBeTruthy();
		expect(joinedResourceDefinitions.contributions.select['roleName']).toBeTruthy();
		expect(joinedResourceDefinitions.articles.select['publicationName']).toBeTruthy();
		expect(joinedResourceDefinitions.tracks.select['recordingName']).toBeTruthy();
	});

	test('recording read model exposes editable version metadata', () => {
		expect(joinedResourceDefinitions.recordings.select['versionName']).toBeTruthy();
		expect(joinedResourceDefinitions.recordings.select['versionDescription']).toBeTruthy();
	});

	test('read models expose every editable field', () => {
		const missingFields: Record<string, string[]> = {};

		for (const resource of adminResources.filter((resource) => resource !== 'article-mentions')) {
			const definition = simpleResourceDefinitions[resource as keyof typeof simpleResourceDefinitions] ?? joinedResourceDefinitions[resource as keyof typeof joinedResourceDefinitions];
			const editableFields = editorConfigs[resource].fields.filter((field) => field.type !== 'target').map((field) => field.key);
			const missing = editableFields.filter((field) => !(field in definition.select));

			if (missing.length > 0) missingFields[resource] = missing;
		}

		expect(missingFields).toEqual({});
	});

	test('composition detail exposes recording version metadata', async () => {
		const fixture: Record<string, unknown> = {
			id: '00000000-0000-4000-8000-000000000001',
			personId: '00000000-0000-4000-8000-000000000002',
			personName: '門田匡陽',
			creditType: 'composer',
			orderIndex: 1,
			versionName: 'ANALYZE [Lost Verse(s) ver.]',
			versionDescription: '2018 remix',
			recordingYear: 2018,
			type: 'studio',
			recordedDate: null,
			recordedFrom: null,
			recordedTo: null,
			releaseDate: null,
			notes: null,
			title: 'BEST',
			format: 'CD',
			eventName: 'Test event',
			eventDate: '2018-01-01',
		};
		const database = {
			select(selection: Record<string, unknown>) {
				const row = Object.fromEntries(Object.keys(selection).map((key) => [key, fixture[key]]));
				const builder = Object.assign(Promise.resolve([row]), {
					from: () => builder,
					innerJoin: () => builder,
					where: () => builder,
					orderBy: () => builder,
				});
				return builder;
			},
		};

		const related = await createCompositionRelatedLoader(database as never)('00000000-0000-4000-8000-000000000003');

		expect(related['recordings']).toEqual([
			expect.objectContaining({
				versionName: 'ANALYZE [Lost Verse(s) ver.]',
				versionDescription: '2018 remix',
			}),
		]);
	});

	test('recording detail exposes the releases containing the recording', async () => {
		const fixture: Record<string, unknown> = {
			id: '00000000-0000-4000-8000-000000000001',
			releaseId: '00000000-0000-4000-8000-000000000002',
			releaseTitle: 'ANALYZE',
			format: 'CD',
			catalogNumber: 'TEST-001',
			releaseDate: '2018-01-01',
			trackNumber: 3,
		};
		const database = {
			select(selection: Record<string, unknown>) {
				const row = Object.fromEntries(Object.keys(selection).map((key) => [key, fixture[key]]));
				const builder = Object.assign(Promise.resolve([row]), {
					from: () => builder,
					innerJoin: () => builder,
					where: () => builder,
					orderBy: () => builder,
				});
				return builder;
			},
		};

		const related = await createRecordingRelatedLoader(database as never)('00000000-0000-4000-8000-000000000003');

		expect(related['releases']).toEqual([
			{
				id: '00000000-0000-4000-8000-000000000001',
				releaseId: '00000000-0000-4000-8000-000000000002',
				releaseTitle: 'ANALYZE',
				format: 'CD',
				catalogNumber: 'TEST-001',
				releaseDate: '2018-01-01',
				trackNumber: 3,
			},
		]);
	});

	test('defines dedicated loaders only for resources with related detail data', () => {
		expect(Object.keys(createRelatedLoaders({} as never)).sort()).toEqual(['articles', 'compositions', 'events', 'people', 'projects', 'recordings', 'releases', 'works'].sort());
	});

	test('builds an empty search clause without binding a function parameter', async () => {
		const queries: Array<{ sql: string; params: unknown[] }> = [];
		const dialect = new PgDialect();
		const database = {
			async execute(statement: Parameters<PgDialect['sqlToQuery']>[0]) {
				const query = dialect.sqlToQuery(statement);
				queries.push(query);
				return { rows: query.sql.includes('count(*)') ? [{ total: 0 }] : [] };
			},
		};
		const repository = createAdminRepository(database as never);

		await repository.list('people', {
			search: '',
			page: 1,
			pageSize: 20,
			direction: 'asc',
		});

		expect(queries).toHaveLength(2);
		expect(queries.flatMap((query) => query.params)).not.toContainEqual(expect.any(Function));
		expect(queries[0]?.sql).not.toContain('$1 order by');
	});

	test('deletes a track through the bound repository', async () => {
		const database = {
			delete() {
				const builder = {
					where: () => builder,
					returning: async () => [{ id: '00000000-0000-4000-8000-000000000001' }],
				};
				return builder;
			},
		};
		const repository = createAdminRepository(database as never);

		expect(await repository.delete('tracks', '00000000-0000-4000-8000-000000000001')).toBe(true);
		expect(await repository.delete('recordings', '00000000-0000-4000-8000-000000000001')).toBe(false);
	});

	test('composes a repository from functions after binding the database dependency', () => {
		const repository = createAdminRepository({} as never);

		expect(Object.keys(repository).sort()).toEqual(['create', 'delete', 'detail', 'list', 'lookup', 'update']);
		for (const operation of Object.values(repository)) {
			expect(typeof operation).toBe('function');
		}
	});
});
