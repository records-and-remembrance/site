import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

const parseJsonc = <T>(source: string): T =>
	JSON.parse(
		source
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/^\s*\/\/.*$/gm, '')
			.replace(/,\s*([}\]])/g, '$1'),
	) as T;

const runBun = async (...args: string[]) => {
	const process = Bun.spawn(['bun', ...args], {
		cwd: root,
		stderr: 'pipe',
		stdout: 'pipe',
	});
	const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);

	return { exitCode, output: `${stdout}${stderr}` };
};

describe('PST-005 site bootstrap', () => {
	test('公開サイト用のexport/build/deploy scriptを公開する', async () => {
		const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
			scripts?: Record<string, string>;
		};

		expect(packageJson.scripts).toMatchObject({
			'site:deploy': 'wrangler deploy --config site/wrangler.jsonc',
			'site:export': 'bun site/export/export.ts',
			'site:build': 'astro build --root site',
		});
	});

	test('DBなしのfixture exportが静的データを生成する', async () => {
		const result = await runBun('run', 'site:export', '--', '--fixture', '--snapshot-generated-at', '2026-07-13T00:00:00.000Z');

		expect(result.exitCode, result.output).toBe(0);

		const generated = JSON.parse(await readFile(join(root, 'site/src/data/site.generated.json'), 'utf8'));

		expect(generated).toMatchObject({
			title: '門田匡陽アーカイブ',
			schemaVersion: 1,
			snapshotGeneratedAt: '2026-07-13T00:00:00.000Z',
			manifest: { schemaVersion: 1, errors: [] },
		});
		expect(generated.tables.project).toEqual([]);
	});

	test('fixtureだけでAstroの静的indexをbuildでき、DB/API実行時依存を含めない', async () => {
		const result = await runBun('run', 'site:build');

		expect(result.exitCode, result.output).toBe(0);

		const html = await readFile(join(root, 'site/dist/index.html'), 'utf8');
		expect(html).toContain('<title>門田匡陽アーカイブ</title>');
		expect(html).toMatch(/<main\b[^>]*>/);
		expect(html).toContain('本文へスキップ');
		expect(html).toContain('主要ナビゲーション');
		expect(html).toContain('href="/#dig"');
		expect(html).not.toContain('/api/site/');
	});

	test('WranglerはAstroの静的出力だけをassetsとして配信する', async () => {
		const wrangler = parseJsonc<{
			assets?: { directory?: string };
			main?: string;
		}>(await readFile(join(root, 'site/wrangler.jsonc'), 'utf8'));

		expect(wrangler.assets?.directory).toBe('./dist');
		expect(wrangler.main).toBeUndefined();
	});
});
