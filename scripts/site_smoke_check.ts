export type SmokeDiagnosticCode = 'INVALID_BASE_URL' | 'INVALID_URL' | 'HTTP_STATUS' | 'FETCH_FAILED';

export type SmokeDiagnostic = {
	code: SmokeDiagnosticCode;
	message: string;
	input?: string;
	url?: string;
	status?: number;
};

export type BaseUrlResolution = { ok: true; value: string } | { ok: false; diagnostic: SmokeDiagnostic };

export type SmokeUrlResolution = { ok: true; value: string } | { ok: false; diagnostic: SmokeDiagnostic };

export type SmokeCheckEntry = {
	input: string;
	url?: string;
	status?: number;
	ok: boolean;
	diagnostic?: SmokeDiagnostic;
};

export type SiteSmokeCheckResult = {
	ok: boolean;
	baseUrl: string | null;
	results: SmokeCheckEntry[];
	diagnostics: SmokeDiagnostic[];
};

export type SmokeFetch = (url: string, init: RequestInit) => Promise<Response>;

export type SiteSmokeCheckOptions = {
	fetch?: SmokeFetch;
};

export const DEFAULT_REPRESENTATIVE_URLS = [
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
] as const;

export type SmokeCheckEnvironment = Readonly<Record<string, string | undefined>>;

export type SiteSmokeCheckCliOptions = SiteSmokeCheckOptions & {
	write?: (message: string) => void;
};

const isHttpUrl = (url: URL): boolean => url.protocol === 'http:' || url.protocol === 'https:';

const invalidBaseUrl = (input: string, message: string): BaseUrlResolution => ({
	ok: false,
	diagnostic: { code: 'INVALID_BASE_URL', input, message },
});

const invalidSmokeUrl = (input: string, message = '代表URLを解決できません。'): SmokeUrlResolution => ({
	ok: false,
	diagnostic: { code: 'INVALID_URL', input, message },
});

export const normalizeBaseUrl = (input: string): BaseUrlResolution => {
	const trimmed = input.trim();
	if (!trimmed) return invalidBaseUrl(input, 'base URLが空です。');

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return invalidBaseUrl(input, 'base URLを解釈できません。');
	}
	if (!isHttpUrl(parsed)) return invalidBaseUrl(input, 'base URLはhttpまたはhttpsで指定してください。');
	if (parsed.search || parsed.hash) return invalidBaseUrl(input, 'base URLにquery/hashを指定できません。');

	const pathname = parsed.pathname.replace(/\/+$/u, '');
	return { ok: true, value: `${parsed.origin}${pathname}` };
};

export const resolveSmokeUrl = (baseUrl: string, input: string): SmokeUrlResolution => {
	const normalizedBase = normalizeBaseUrl(baseUrl);
	if (!normalizedBase.ok) return normalizedBase;

	const trimmed = input.trim();
	if (!trimmed) return invalidSmokeUrl(input);

	try {
		const resolved = new URL(trimmed, `${normalizedBase.value}/`);
		if (!isHttpUrl(resolved)) return invalidSmokeUrl(input, '代表URLはhttpまたはhttpsで指定してください。');
		return { ok: true, value: resolved.toString() };
	} catch {
		return invalidSmokeUrl(input);
	}
};

const diagnosticForFetchFailure = (input: string, url: string, error: unknown): SmokeDiagnostic => ({
	code: 'FETCH_FAILED',
	input,
	url,
	message: `GET failed: ${error instanceof Error ? error.message : String(error)}`,
});

const checkSmokeUrl = async (baseUrl: string, input: string, fetcher: SmokeFetch): Promise<SmokeCheckEntry> => {
	const resolution = resolveSmokeUrl(baseUrl, input);
	if (!resolution.ok) return { input, ok: false, diagnostic: resolution.diagnostic };

	try {
		const response = await fetcher(resolution.value, { method: 'GET' });
		if (response.status < 200 || response.status >= 300) {
			return {
				input,
				url: resolution.value,
				ok: false,
				status: response.status,
				diagnostic: {
					code: 'HTTP_STATUS',
					input,
					url: resolution.value,
					status: response.status,
					message: `GET returned HTTP ${response.status}`,
				},
			};
		}
		return { input, url: resolution.value, ok: true, status: response.status };
	} catch (error) {
		return { input, url: resolution.value, ok: false, diagnostic: diagnosticForFetchFailure(input, resolution.value, error) };
	}
};

export const runSiteSmokeCheck = async (baseUrl: string, inputs: readonly string[], options: SiteSmokeCheckOptions = {}): Promise<SiteSmokeCheckResult> => {
	const normalizedBase = normalizeBaseUrl(baseUrl);
	if (!normalizedBase.ok) return { ok: false, baseUrl: null, results: [], diagnostics: [normalizedBase.diagnostic] };

	const fetcher = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
	const results: SmokeCheckEntry[] = [];
	for (const input of inputs) results.push(await checkSmokeUrl(normalizedBase.value, input, fetcher));
	const diagnostics = results.flatMap((result) => (result.diagnostic ? [result.diagnostic] : []));
	return { ok: diagnostics.length === 0, baseUrl: normalizedBase.value, results, diagnostics };
};

const writeToConsole = (message: string): void => console.log(message);

export const runSiteSmokeCheckCli = async (env: SmokeCheckEnvironment, options: SiteSmokeCheckCliOptions = {}): Promise<SiteSmokeCheckResult> => {
	const write = options.write ?? writeToConsole;
	const baseUrl = env.SITE_PUBLIC_URL;
	if (!baseUrl) {
		const result: SiteSmokeCheckResult = {
			ok: false,
			baseUrl: null,
			results: [],
			diagnostics: [{ code: 'INVALID_BASE_URL', input: 'SITE_PUBLIC_URL', message: 'SITE_PUBLIC_URL is required.' }],
		};
		write(JSON.stringify(result.diagnostics));
		return result;
	}

	const smokeOptions: SiteSmokeCheckOptions = options.fetch ? { fetch: options.fetch } : {};
	const result = await runSiteSmokeCheck(baseUrl, DEFAULT_REPRESENTATIVE_URLS, smokeOptions);
	if (result.ok) write(`site smoke check ok: ${result.results.length} URLs`);
	else write(JSON.stringify(result.diagnostics));
	return result;
};

if (import.meta.main) {
	const result = await runSiteSmokeCheckCli(Bun.env);
	if (!result.ok) process.exitCode = 1;
}
