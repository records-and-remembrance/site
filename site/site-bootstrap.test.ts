import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

// exportとbuildの出力先を一時ディレクトリへ隔離する。既定の出力先へ書くと、
// テストを走らせるたびに本番相当の site/src/data/site.generated.json と
// site/dist が fixture の空データで置き換わる。
let workDirectory = '';
let fixturePath = '';
let distDirectory = '';
let exportResult: { exitCode: number; output: string };

const parseJsonc = <T>(source: string): T =>
	JSON.parse(
		source
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/^\s*\/\/.*$/gm, '')
			.replace(/,\s*([}\]])/g, '$1'),
	) as T;

const runBun = async (args: readonly string[], environment: Record<string, string> = {}) => {
	const process = Bun.spawn(['bun', ...args], {
		cwd: root,
		env: { ...Bun.env, ...environment },
		stderr: 'pipe',
		stdout: 'pipe',
	});
	const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);

	return { exitCode, output: `${stdout}${stderr}` };
};

describe('PST-005 site bootstrap', () => {
	beforeAll(async () => {
		workDirectory = await mkdtemp(join(tmpdir(), 'monden-site-bootstrap-'));
		fixturePath = join(workDirectory, 'site.generated.json');
		distDirectory = join(workDirectory, 'dist');
		exportResult = await runBun(['run', 'site:export', '--', '--fixture', '--snapshot-generated-at', '2026-07-13T00:00:00.000Z', '--output', fixturePath]);
	});

	afterAll(async () => {
		await rm(workDirectory, { force: true, recursive: true });
	});

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
		expect(exportResult.exitCode, exportResult.output).toBe(0);

		const generated = JSON.parse(await readFile(fixturePath, 'utf8'));

		expect(generated).toMatchObject({
			title: '門田匡陽アーカイブ',
			schemaVersion: 1,
			snapshotGeneratedAt: '2026-07-13T00:00:00.000Z',
			manifest: { schemaVersion: 1, errors: [] },
		});
		expect(generated.tables.project).toEqual([]);
	});

	test('fixtureだけでAstroの静的indexをbuildでき、DB/API実行時依存を含めない', async () => {
		const result = await runBun(['run', 'site:build', '--', '--outDir', distDirectory], { SITE_DATA_PATH: fixturePath });

		expect(result.exitCode, result.output).toBe(0);

		const html = await readFile(join(distDirectory, 'index.html'), 'utf8');
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
