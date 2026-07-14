import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkSiteArtifacts } from './site_check';

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('PST-029 site artifact check', () => {
	test('required route・Pagefind・internal linkを検査し、API/DB参照を検出する', async () => {
		const root = join('/tmp', `site-check-${Date.now()}-${Math.random().toString(16).slice(2)}`);
		roots.push(root);
		for (const file of [
			'about/index.html',
			'discography/index.html',
			'lives/index.html',
			'people/index.html',
			'projects/index.html',
			'songs/index.html',
			'venues/index.html',
			'network/index.html',
			'timeline/index.html',
			'library/index.html',
			'search/index.html',
		]) {
			await mkdir(join(root, file.slice(0, file.lastIndexOf('/'))), { recursive: true });
			await writeFile(join(root, file), '<html></html>');
		}
		await mkdir(join(root, 'pagefind'), { recursive: true });
		await writeFile(join(root, 'pagefind/pagefind.js'), 'export {};');
		await writeFile(join(root, '404.html'), '<html></html>');
		await writeFile(join(root, 'index.html'), '<a href="/about/">about</a>');
		const result = checkSiteArtifacts(root);
		expect(result.brokenLinks).toEqual([]);
		expect(result.forbiddenRequests).toEqual([]);
	});
});
