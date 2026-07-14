import { describe, expect, test } from 'bun:test';
import { DEFAULT_REPRESENTATIVE_URLS, normalizeBaseUrl, resolveSmokeUrl, runSiteSmokeCheck, runSiteSmokeCheckCli, type SmokeFetch } from './site_smoke_check';

describe('site smoke check URL normalization', () => {
	test('base URLの末尾slashを正規化し、相対URLを解決する', () => {
		expect(normalizeBaseUrl(' https://public.example/preview/// ')).toEqual({ ok: true, value: 'https://public.example/preview' });
		expect(resolveSmokeUrl('https://public.example/preview/', '/about/')).toEqual({ ok: true, value: 'https://public.example/about/' });
		expect(resolveSmokeUrl('https://public.example/preview/', 'library')).toEqual({ ok: true, value: 'https://public.example/preview/library' });
	});

	test('不正なbase URLと代表URLを診断する', () => {
		expect(normalizeBaseUrl('not a URL')).toMatchObject({ ok: false, diagnostic: { code: 'INVALID_BASE_URL' } });
		expect(resolveSmokeUrl('https://public.example', 'http://[invalid')).toMatchObject({ ok: false, diagnostic: { code: 'INVALID_URL', input: 'http://[invalid' } });
	});
});

describe('runSiteSmokeCheck', () => {
	test('代表URLごとにGETし、全URL成功時はokになる', async () => {
		const calls: Array<{ url: string; method: string | undefined }> = [];
		const fetch: SmokeFetch = async (url, init) => {
			calls.push({ url, method: init.method });
			return new Response(null, { status: 200 });
		};

		const result = await runSiteSmokeCheck('https://public.example/', ['/', '/discography/', 'search?q=ANALYZE'], { fetch });

		expect(result).toEqual({
			ok: true,
			baseUrl: 'https://public.example',
			results: [
				{ input: '/', url: 'https://public.example/', ok: true, status: 200 },
				{ input: '/discography/', url: 'https://public.example/discography/', ok: true, status: 200 },
				{ input: 'search?q=ANALYZE', url: 'https://public.example/search?q=ANALYZE', ok: true, status: 200 },
			],
			diagnostics: [],
		});
		expect(calls).toEqual([
			{ url: 'https://public.example/', method: 'GET' },
			{ url: 'https://public.example/discography/', method: 'GET' },
			{ url: 'https://public.example/search?q=ANALYZE', method: 'GET' },
		]);
	});

	test('2xx以外の応答をstatus付きで診断する', async () => {
		const fetch: SmokeFetch = async () => new Response(null, { status: 404, statusText: 'Not Found' });

		const result = await runSiteSmokeCheck('https://public.example', ['/missing'], { fetch });

		expect(result.ok).toBe(false);
		expect(result.results).toEqual([
			{
				input: '/missing',
				url: 'https://public.example/missing',
				ok: false,
				status: 404,
				diagnostic: { code: 'HTTP_STATUS', input: '/missing', url: 'https://public.example/missing', status: 404, message: 'GET returned HTTP 404' },
			},
		]);
		expect(result.diagnostics).toEqual(result.results.flatMap((entry) => (entry.diagnostic ? [entry.diagnostic] : [])));
	});

	test('fetch失敗とURL不正をそれぞれ診断し、後続URLも検査する', async () => {
		const fetch: SmokeFetch = async (url) => {
			if (url.endsWith('/broken')) throw new Error('connection refused');
			return new Response(null, { status: 204 });
		};

		const result = await runSiteSmokeCheck('https://public.example', ['/broken', 'http://[invalid', '/ok'], { fetch });

		expect(result.ok).toBe(false);
		expect(result.results).toEqual([
			{
				input: '/broken',
				url: 'https://public.example/broken',
				ok: false,
				diagnostic: { code: 'FETCH_FAILED', input: '/broken', url: 'https://public.example/broken', message: 'GET failed: connection refused' },
			},
			{
				input: 'http://[invalid',
				ok: false,
				diagnostic: { code: 'INVALID_URL', input: 'http://[invalid', message: '代表URLを解決できません。' },
			},
			{ input: '/ok', url: 'https://public.example/ok', ok: true, status: 204 },
		]);
		expect(result.diagnostics.map(({ code }) => code)).toEqual(['FETCH_FAILED', 'INVALID_URL']);
	});

	test('base URL不正時はfetchせず、base診断を返す', async () => {
		let calls = 0;
		const fetch: SmokeFetch = async () => {
			calls += 1;
			return new Response(null, { status: 200 });
		};

		const result = await runSiteSmokeCheck('not a URL', ['/'], { fetch });

		expect(result).toMatchObject({ ok: false, baseUrl: null, results: [], diagnostics: [{ code: 'INVALID_BASE_URL' }] });
		expect(calls).toBe(0);
	});
});

describe('site smoke check CLI', () => {
	test('SITE_PUBLIC_URL未設定時はfetchせず、診断をJSONで表示する', async () => {
		const output: string[] = [];
		let calls = 0;
		const fetch: SmokeFetch = async () => {
			calls += 1;
			return new Response(null, { status: 200 });
		};

		const result = await runSiteSmokeCheckCli({}, { fetch, write: (message) => output.push(message) });

		expect(result).toMatchObject({ ok: false, baseUrl: null, results: [], diagnostics: [{ code: 'INVALID_BASE_URL', message: 'SITE_PUBLIC_URL is required.' }] });
		expect(JSON.parse(output[0] ?? '')).toEqual(result.diagnostics);
		expect(calls).toBe(0);
	});

	test('指定された代表URLをGETし、全件成功時はsummaryを表示する', async () => {
		const output: string[] = [];
		const calls: Array<{ url: string; method: string | undefined }> = [];
		const fetch: SmokeFetch = async (url, init) => {
			calls.push({ url, method: init.method });
			return new Response(null, { status: 200 });
		};

		const result = await runSiteSmokeCheckCli({ SITE_PUBLIC_URL: 'https://public.example/' }, { fetch, write: (message) => output.push(message) });

		expect(DEFAULT_REPRESENTATIVE_URLS).toEqual([
			'/',
			'/about/',
			'/projects/',
			'/people/',
			'/discography/',
			'/songs/',
			'/lives/',
			'/venues/',
			'/network/',
			'/timeline/',
			'/library/',
			'/search/',
			'/404.html',
		]);
		expect(result.ok).toBe(true);
		expect(calls).toEqual(DEFAULT_REPRESENTATIVE_URLS.map((path) => ({ url: `https://public.example${path}`, method: 'GET' })));
		expect(output).toEqual(['site smoke check ok: 13 URLs']);
	});

	test('代表URLのHTTP失敗時は診断配列をJSONで表示する', async () => {
		const output: string[] = [];
		const fetch: SmokeFetch = async (url) => new Response(null, { status: url.endsWith('/about/') ? 503 : 200 });

		const result = await runSiteSmokeCheckCli({ SITE_PUBLIC_URL: 'https://public.example' }, { fetch, write: (message) => output.push(message) });

		expect(result.ok).toBe(false);
		expect(JSON.parse(output[0] ?? '')).toEqual(result.diagnostics);
		expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'HTTP_STATUS', input: '/about/', status: 503 })]);
	});
});
