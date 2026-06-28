import { expect, test } from 'bun:test';
import type { AdminRepository } from './admin/types';
import { createApp } from './server';

const repository: AdminRepository = {
	async list() {
		return { items: [], total: 0 };
	},
	async detail() {
		return null;
	},
	async create(_resource, value) {
		return value;
	},
	async update(_resource, id, value) {
		return { id, ...value };
	},
	async lookup() {
		return [];
	},
};

test('keeps the composition review UI and mounts the admin API', async () => {
	const app = createApp({ adminRepository: repository });

	const reviewResponse = await app.request('/');
	expect(reviewResponse.status).toBe(200);
	expect(reviewResponse.headers.get('content-type')).toContain('text/html');

	const adminResponse = await app.request('/api/admin/people');
	expect(adminResponse.status).toBe(200);
	expect(await adminResponse.json()).toEqual({
		data: [],
		meta: { page: 1, pageSize: 20, total: 0 },
	});
});
