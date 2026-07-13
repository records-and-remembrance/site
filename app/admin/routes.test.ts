import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { createAdminRoutes } from './routes';
import type { AdminListQuery, AdminRepository, AdminResource, LookupResource } from './types';
import type { ArtworkStorage } from '../artwork/storage';

const generatedId = '00000000-0000-4000-8000-000000000001';

class FakeRepository implements AdminRepository {
	calls: Array<{ method: string; resource: string; value?: unknown }> = [];
	artwork: Record<string, unknown> = {
		id: generatedId,
		artworkUrl: null,
		artworkWidth: null,
		artworkHeight: null,
	};

	async list(resource: AdminResource, query: AdminListQuery) {
		this.calls.push({ method: 'list', resource, value: query });
		return { items: [{ id: generatedId, name: '門田匡陽' }], total: 1 };
	}

	async detail(resource: AdminResource, id: string) {
		this.calls.push({ method: 'detail', resource, value: id });
		return { id, name: '門田匡陽', related: {} };
	}

	async create(resource: AdminResource, value: Record<string, unknown>) {
		this.calls.push({ method: 'create', resource, value });
		return value;
	}

	async update(resource: AdminResource, id: string, value: Record<string, unknown>) {
		this.calls.push({ method: 'update', resource, value: { id, ...value } });
		return { id, ...value };
	}

	async updateArtwork(id: string, value: { artworkUrl: string; artworkWidth: number; artworkHeight: number }) {
		this.calls.push({ method: 'updateArtwork', resource: 'releases', value: { id, ...value } });
		this.artwork = { ...this.artwork, id, ...value };
		return this.artwork;
	}

	async delete(resource: AdminResource, id: string) {
		this.calls.push({ method: 'delete', resource, value: id });
		return true;
	}

	async lookup(resource: LookupResource, search: string) {
		this.calls.push({ method: 'lookup', resource, value: search });
		return [{ id: generatedId, label: 'BURGER NUDS' }];
	}
}

function testApp(repository: AdminRepository, artworkStorage?: ArtworkStorage) {
	const app = new Hono();
	app.route(
		'/api/admin',
		createAdminRoutes(repository, {
			uuid: () => generatedId,
			...(artworkStorage ? { artworkStorage } : {}),
		}),
	);
	return app;
}

describe('admin API', () => {
	test('deletes a track by id', async () => {
		const repository = new FakeRepository();
		const response = await testApp(repository).request(`/api/admin/tracks/${generatedId}`, {
			method: 'DELETE',
		});

		expect(response.status).toBe(204);
		expect(repository.calls).toContainEqual({
			method: 'delete',
			resource: 'tracks',
			value: generatedId,
		});
	});

	test('passes normalized list state to the repository', async () => {
		const repository = new FakeRepository();
		const response = await testApp(repository).request('/api/admin/people?search=%E9%96%80%E7%94%B0&page=2&pageSize=25&sort=name&direction=desc');

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: [{ id: generatedId, name: '門田匡陽' }],
			meta: { page: 2, pageSize: 25, total: 1 },
		});
		expect(repository.calls[0]).toEqual({
			method: 'list',
			resource: 'people',
			value: {
				search: '門田',
				page: 2,
				pageSize: 25,
				sort: 'name',
				direction: 'desc',
			},
		});
	});

	test('rejects invalid pagination with the shared validation error shape', async () => {
		const response = await testApp(new FakeRepository()).request('/api/admin/projects?page=0&pageSize=500');

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: {
				code: 'VALIDATION_ERROR',
				message: 'Request validation failed',
				fields: expect.any(Object),
			},
		});
	});

	test('generates UUIDs on create and rejects client supplied IDs', async () => {
		const repository = new FakeRepository();
		const app = testApp(repository);

		const created = await app.request('/api/admin/people', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: '新規人物', birthDate: '2000-01-02' }),
		});
		expect(created.status).toBe(201);
		expect(repository.calls[0]?.value).toMatchObject({
			id: generatedId,
			name: '新規人物',
			birthDate: '2000-01-02',
		});

		const rejected = await app.request('/api/admin/people', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id: crypto.randomUUID(), name: '不正' }),
		});
		expect(rejected.status).toBe(400);
	});

	test('accepts ordered composer and lyricist credits for a composition', async () => {
		const repository = new FakeRepository();
		const app = testApp(repository);
		const compositionId = '00000000-0000-4000-8000-000000000002';
		const personId = '00000000-0000-4000-8000-000000000003';

		for (const creditType of ['composer', 'lyricist']) {
			const response = await app.request('/api/admin/composition-credits', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ compositionId, personId, creditType, orderIndex: 1 }),
			});

			expect(response.status).toBe(201);
		}

		expect(repository.calls.map((call) => call.value)).toEqual([
			{ id: generatedId, compositionId, personId, creditType: 'composer', orderIndex: 1 },
			{ id: generatedId, compositionId, personId, creditType: 'lyricist', orderIndex: 1 },
		]);
	});

	test('rejects unsupported composition credit types and non-positive order', async () => {
		const app = testApp(new FakeRepository());
		const base = {
			compositionId: '00000000-0000-4000-8000-000000000002',
			personId: '00000000-0000-4000-8000-000000000003',
		};

		const invalidType = await app.request('/api/admin/composition-credits', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...base, creditType: 'arranger', orderIndex: 1 }),
		});
		const invalidOrder = await app.request('/api/admin/composition-credits', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...base, creditType: 'composer', orderIndex: 0 }),
		});

		expect(invalidType.status).toBe(400);
		expect(invalidOrder.status).toBe(400);
	});

	test('uses the platform UUID generator when no generator is injected', async () => {
		const repository = new FakeRepository();
		const app = new Hono();
		app.route('/api/admin', createAdminRoutes(repository));

		const response = await app.request('/api/admin/people', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: '新規人物' }),
		});

		expect(response.status).toBe(201);
		expect(repository.calls[0]?.value).toMatchObject({
			id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
		});
	});

	test('validates required foreign keys and date formats', async () => {
		const response = await testApp(new FakeRepository()).request('/api/admin/events', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				projectId: 'raw-project-name',
				venueId: generatedId,
				type: 'live',
				eventDate: '2025/01/01',
			}),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: {
				code: 'VALIDATION_ERROR',
				fields: {
					projectId: expect.any(Array),
					eventDate: expect.any(Array),
				},
			},
		});
	});

	test('accepts support status for memberships', async () => {
		const repository = new FakeRepository();
		const response = await testApp(repository).request('/api/admin/memberships', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				personId: generatedId,
				projectId: generatedId,
				fromDate: '2025-01-01',
				support: true,
			}),
		});

		expect(response.status).toBe(201);
		expect(repository.calls[0]?.value).toMatchObject({
			support: true,
		});
	});

	test('accepts editorial types for works', async () => {
		const repository = new FakeRepository();
		const response = await testApp(repository).request('/api/admin/works', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				projectId: generatedId,
				title: 'Live Album',
				type: 'live',
			}),
		});

		expect(response.status).toBe(201);
		expect(repository.calls[0]?.value).toMatchObject({
			type: 'live',
		});
	});

	test('accepts only defined non-null recording types', async () => {
		const repository = new FakeRepository();
		const app = testApp(repository);
		const base = {
			compositionId: generatedId,
			versionName: 'Album version',
			versionDescription: 'ストリングスを加えたバージョン',
			recordingYear: null,
			recordedDate: null,
			recordedFrom: null,
			recordedTo: null,
			releaseDate: null,
			notes: null,
		};

		for (const type of ['studio', 'live', 'demo', 'rehearsal', 'other']) {
			const response = await app.request('/api/admin/recordings', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...base, type }),
			});
			expect(response.status).toBe(201);
			expect(repository.calls.at(-1)?.value).toMatchObject({
				versionName: 'Album version',
				versionDescription: 'ストリングスを加えたバージョン',
			});
		}

		for (const type of [null, 'unknown', 'acoustic']) {
			const response = await app.request('/api/admin/recordings', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...base, type }),
			});
			expect(response.status).toBe(400);
		}
	});

	test('accepts release edition lineage', async () => {
		const repository = new FakeRepository();
		const response = await testApp(repository).request('/api/admin/releases', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				workId: generatedId,
				format: 'CD',
				editionType: 'reissue',
				reissueOfReleaseId: generatedId,
			}),
		});

		expect(response.status).toBe(201);
		expect(repository.calls[0]?.value).toMatchObject({
			editionType: 'reissue',
			reissueOfReleaseId: generatedId,
		});
	});

	test('uploads release artwork and updates URL and dimensions as one contract', async () => {
		const repository = new FakeRepository();
		const stored: Array<{ key: string; contentType: string; body: Uint8Array }> = [];
		const artworkStorage: ArtworkStorage = {
			put: async (input) => {
				stored.push(input);
				return { key: input.key, url: `https://cdn.example/${input.key}` };
			},
		};
		const form = new FormData();
		form.append(
			'artwork',
			new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 4, 0, 0, 0, 3, 0])], 'cover.png', { type: 'image/png' }),
		);

		const response = await testApp(repository, artworkStorage).request(`/api/admin/releases/${generatedId}/artwork`, {
			method: 'POST',
			body: form,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			data: {
				id: generatedId,
				artworkUrl: expect.stringContaining('https://cdn.example/'),
				artworkWidth: 1024,
				artworkHeight: 768,
			},
		});
		expect(stored[0]).toMatchObject({ contentType: 'image/png' });
		expect(repository.calls).toContainEqual({
			method: 'updateArtwork',
			resource: 'releases',
			value: {
				id: generatedId,
				artworkUrl: expect.stringContaining('https://cdn.example/'),
				artworkWidth: 1024,
				artworkHeight: 768,
			},
		});
	});

	test('rejects an invalid artwork without touching the release', async () => {
		const repository = new FakeRepository();
		let putCalled = false;
		const artworkStorage: ArtworkStorage = {
			put: async () => {
				putCalled = true;
				return { key: 'unused', url: 'https://cdn.example/unused' };
			},
		};
		const form = new FormData();
		form.append('artwork', new File(['bad'], 'cover.gif', { type: 'image/gif' }));

		const response = await testApp(repository, artworkStorage).request(`/api/admin/releases/${generatedId}/artwork`, {
			method: 'POST',
			body: form,
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: { code: 'ARTWORK_FORMAT_NOT_ALLOWED' } });
		expect(putCalled).toBe(false);
		expect(repository.calls).not.toContainEqual(expect.objectContaining({ method: 'updateArtwork' }));
	});

	test('does not update the release when storage fails', async () => {
		const repository = new FakeRepository();
		const artworkStorage: ArtworkStorage = {
			put: async () => {
				throw new Error('R2 unavailable');
			},
		};
		const form = new FormData();
		form.append(
			'artwork',
			new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 4, 0, 0, 0, 3, 0])], 'cover.png', { type: 'image/png' }),
		);

		const response = await testApp(repository, artworkStorage).request(`/api/admin/releases/${generatedId}/artwork`, {
			method: 'POST',
			body: form,
		});

		expect(response.status).toBe(502);
		expect(await response.json()).toMatchObject({ error: { code: 'ARTWORK_STORAGE_ERROR' } });
		expect(repository.calls).not.toContainEqual(expect.objectContaining({ method: 'updateArtwork' }));
	});

	test('accepts project roles on multi-artist works', async () => {
		const repository = new FakeRepository();
		const response = await testApp(repository).request('/api/admin/work-projects', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				workId: generatedId,
				projectId: generatedId,
				relationType: 'participant',
			}),
		});

		expect(response.status).toBe(201);
		expect(repository.calls[0]?.value).toMatchObject({
			relationType: 'participant',
		});
	});

	test('exposes all domain and lookup resource groups', async () => {
		const repository = new FakeRepository();
		const app = testApp(repository);
		const domains = [
			'people',
			'projects',
			'works',
			'work-projects',
			'events',
			'compositions',
			'articles',
			'contributions',
			'memberships',
			'releases',
			'recordings',
			'tracks',
			'event-performances',
			'article-mentions',
		];
		const lookups = ['project', 'person', 'composition', 'work', 'release', 'event', 'venue', 'role', 'instrument', 'label', 'distributor', 'publication'];

		for (const resource of domains) {
			expect((await app.request(`/api/admin/${resource}`)).status).toBe(200);
		}
		for (const resource of lookups) {
			expect((await app.request(`/api/admin/lookups/${resource}?search=a`)).status).toBe(200);
		}
	});

	test('maps unique, foreign key and check constraint failures', async () => {
		const cases = [
			['23505', 'CONFLICT', 409],
			['23503', 'INVALID_REFERENCE', 400],
			['23514', 'CONSTRAINT_VIOLATION', 400],
		] as const;

		for (const [databaseCode, apiCode, status] of cases) {
			const repository = new FakeRepository();
			repository.create = async () => {
				throw Object.assign(new Error('database rejected value'), {
					code: databaseCode,
					constraint: 'example_constraint',
				});
			};
			const response = await testApp(repository).request('/api/admin/projects', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: '重複', type: 'band' }),
			});

			expect(response.status).toBe(status);
			expect(await response.json()).toMatchObject({
				error: {
					code: apiCode,
					constraint: 'example_constraint',
				},
			});
		}
	});

	test('maps PostgreSQL errors wrapped by Drizzle', async () => {
		const repository = new FakeRepository();
		repository.create = async () => {
			throw Object.assign(new Error('Failed query'), {
				cause: Object.assign(new Error('duplicate key'), {
					code: '23505',
					constraint: 'project_name_unique',
				}),
			});
		};

		const response = await testApp(repository).request('/api/admin/projects', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: '重複', type: 'band' }),
		});

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: {
				code: 'CONFLICT',
				constraint: 'project_name_unique',
			},
		});
	});

	test('project scopeを既定値で補完し、monden/externalだけを作成・編集できる', async () => {
		const repository = new FakeRepository();
		const createDefaultResponse = await testApp(repository).request('/api/admin/projects', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: '門田プロジェクト', type: 'band' }),
		});
		const createExternalResponse = await testApp(repository).request('/api/admin/projects', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: '外部プロジェクト', type: 'band', scope: 'external' }),
		});
		const updateResponse = await testApp(repository).request(`/api/admin/projects/${generatedId}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: '外部プロジェクト', type: 'band', scope: 'external' }),
		});

		expect(createDefaultResponse.status).toBe(201);
		expect(createExternalResponse.status).toBe(201);
		expect(updateResponse.status).toBe(200);
		expect(repository.calls).toContainEqual(expect.objectContaining({ method: 'create', value: expect.objectContaining({ scope: 'monden' }) }));
		expect(repository.calls).toContainEqual(expect.objectContaining({ method: 'create', value: expect.objectContaining({ scope: 'external' }) }));
		expect(repository.calls).toContainEqual(expect.objectContaining({ method: 'update', value: expect.objectContaining({ scope: 'external' }) }));
	});

	test('project scopeの不正値をadmin APIで拒否する', async () => {
		const repository = new FakeRepository();
		const response = await testApp(repository).request('/api/admin/projects', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: '不正scope', type: 'band', scope: 'all' }),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR', fields: { scope: expect.any(Array) } } });
		expect(repository.calls).not.toContainEqual(expect.objectContaining({ method: 'create', resource: 'projects' }));
	});
});
