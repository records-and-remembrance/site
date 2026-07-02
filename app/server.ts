#!/usr/bin/env bun

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { createAdminRoutes } from './admin/routes';
import { createAdminRepository } from './admin/repository';
import type { AdminRepository } from './admin/types';
import { db } from './db';
import { listDrafts, mergeDraft, readDraft, saveDraft, validateMergePayload, validateSavePayload } from './lib/compositionDrafts';
import { createRecordingOrganizerRepository } from './recording-organizer/repository';
import { createRecordingOrganizerRoutes } from './recording-organizer/routes';
import type { RecordingOrganizerRepository } from './recording-organizer/types';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC_DIR = join(ROOT, 'app', 'public');

interface AppOptions {
	adminRepository?: AdminRepository;
	recordingOrganizerRepository?: RecordingOrganizerRepository;
}

export function createApp(options: AppOptions = {}) {
	const app = new Hono();
	const adminRepository = options.adminRepository ?? createAdminRepository(db);
	const recordingOrganizerRepository = options.recordingOrganizerRepository ?? createRecordingOrganizerRepository(db);

	app.get('/', async (c) => {
		return c.html(await readPublicFile('index.html'));
	});

	app.get('/app.js', async (c) => {
		return new Response(await readPublicFile('app.js'), {
			headers: {
				'content-type': 'text/javascript; charset=utf-8',
				'cache-control': 'no-store',
			},
		});
	});

	app.get('/admin', (c) => {
		return c.redirect(Bun.env.ADMIN_URL ?? 'http://localhost:5173/admin/');
	});

	app.get('/api/drafts', async (c) => {
		return c.json(await listDrafts());
	});

	app.get('/api/drafts/:file', async (c) => {
		return c.json(await readDraft(c.req.param('file')));
	});

	app.put('/api/drafts/:file', async (c) => {
		const payload = validateSavePayload(await c.req.json());
		return c.json(await saveDraft(c.req.param('file'), payload));
	});

	app.post('/api/drafts/:file/merge', async (c) => {
		const payload = validateMergePayload(await c.req.json());
		return c.json(await mergeDraft(c.req.param('file'), payload));
	});

	app.route('/api/admin', createAdminRoutes(adminRepository));
	app.route('/api/recording-organizer', createRecordingOrganizerRoutes(recordingOrganizerRepository));

	app.notFound((c) => c.json({ error: 'not found' }, 404));

	app.onError((error, c) => {
		return c.json({ error: error.message }, 400);
	});

	return app;
}

async function readPublicFile(fileName: string): Promise<string> {
	return await readFile(join(PUBLIC_DIR, fileName), 'utf8');
}

if (import.meta.main) {
	const app = createApp();
	const port = Number(Bun.env.PORT ?? '3000');
	Bun.serve({
		port,
		fetch: app.fetch,
	});

	console.log(`Composition draft review UI: http://localhost:${port}`);
	console.log(`Admin API: http://localhost:${port}/api/admin`);
	console.log(`Recording organizer API: http://localhost:${port}/api/recording-organizer`);
}
