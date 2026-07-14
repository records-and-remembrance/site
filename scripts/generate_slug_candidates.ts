import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SLUG_ENTITY_TYPES = ['project', 'person', 'composition', 'work', 'venue'] as const;
export type SlugEntityType = (typeof SLUG_ENTITY_TYPES)[number];

export type SlugSourceRow = {
	id: string;
	displayName: string;
	slug?: string | null;
	/** Optional human-provided reading for kanji that the default resolver cannot infer. */
	reading?: string | null;
};

export type SlugSnapshot = {
	sourceSnapshot?: string;
} & {
	[K in SlugEntityType]: readonly SlugSourceRow[];
};

export type JapaneseReadingResolver = (value: string) => string | null;

export type SlugifyOptions = {
	reading?: string | null;
	resolveJapaneseReading?: JapaneseReadingResolver;
};

export type SlugDiagnosticCode = 'empty-display-name' | 'empty-candidate' | 'untransliterated-characters' | 'existing-slug-empty' | 'collision';

export type SlugDiagnostic = {
	code: SlugDiagnosticCode;
	message: string;
	characters?: string;
};

export type SlugAnalysis = {
	baseSlug: string | null;
	normalizedValue: string;
	basis: {
		method: 'preserved' | 'kebab-case' | 'hepburn' | 'mixed' | 'unconvertible';
		source: 'display-name' | 'reading';
	};
	diagnostics: SlugDiagnostic[];
};

export type SlugCollision = {
	detected: true;
	baseSlug: string;
	assignedSuffix: number;
	conflictingEntityIds: string[];
};

export type SlugCandidateRecord = {
	entityType: SlugEntityType;
	id: string;
	displayName: string;
	existingSlug: string | null;
	candidateSlug: string | null;
	aiSuggestedSlug?: string | null;
	basis: SlugAnalysis['basis'];
	status: 'proposed' | 'preserved' | 'needs_review';
	diagnostics: SlugDiagnostic[];
	collision: SlugCollision | null;
};

export type SlugCandidateArtifact = {
	schemaVersion: 1;
	generatedBy: 'scripts/generate_slug_candidates.ts';
	sourceSnapshot: string;
	entityTypes: readonly SlugEntityType[];
	summary: {
		total: number;
		proposed: number;
		preserved: number;
		needsReview: number;
		collisions: number;
		unresolved: number;
	};
	records: SlugCandidateRecord[];
};

type PreparedRecord = {
	entityType: SlugEntityType;
	row: SlugSourceRow;
	existingSlug: string | null;
	baseSlug: string | null;
	candidateSlug: string | null;
	basis: SlugAnalysis['basis'];
	status: SlugCandidateRecord['status'];
	diagnostics: SlugDiagnostic[];
	collision: SlugCollision | null;
	assignedSuffix: number | null;
};

type ParsedArgs = {
	input: string;
	output: string;
};

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_INPUT = join(ROOT, 'drafts', 'slugs', 'entities.json');
const DEFAULT_OUTPUT = join(ROOT, 'drafts', 'slugs', 'slug-candidates.json');

const JAPANESE_WORD_READINGS: ReadonlyArray<readonly [string, string]> = [
	['黄金の鐘', 'おうごん の かね'],
	['門田匡陽', 'かどた まさたか'],
	['下北沢', 'しもきたざわ'],
	['新宿', 'しんじゅく'],
	['黄金', 'おうごん'],
	['門田', 'かどた'],
	['匡陽', 'まさたか'],
	['鐘', 'かね'],
];

const KANA_DIGRAPHS: Readonly<Record<string, string>> = {
	きゃ: 'kya',
	きゅ: 'kyu',
	きょ: 'kyo',
	ぎゃ: 'gya',
	ぎゅ: 'gyu',
	ぎょ: 'gyo',
	しゃ: 'sha',
	しゅ: 'shu',
	しょ: 'sho',
	じゃ: 'ja',
	じゅ: 'ju',
	じょ: 'jo',
	ちゃ: 'cha',
	ちゅ: 'chu',
	ちょ: 'cho',
	ぢゃ: 'ja',
	ぢゅ: 'ju',
	ぢょ: 'jo',
	にゃ: 'nya',
	にゅ: 'nyu',
	にょ: 'nyo',
	ひゃ: 'hya',
	ひゅ: 'hyu',
	ひょ: 'hyo',
	びゃ: 'bya',
	びゅ: 'byu',
	びょ: 'byo',
	ぴゃ: 'pya',
	ぴゅ: 'pyu',
	ぴょ: 'pyo',
	みゃ: 'mya',
	みゅ: 'myu',
	みょ: 'myo',
	りゃ: 'rya',
	りゅ: 'ryu',
	りょ: 'ryo',
	うぃ: 'wi',
	うぇ: 'we',
	うぉ: 'wo',
	いぇ: 'ye',
	しぇ: 'she',
	じぇ: 'je',
	ちぇ: 'che',
	つぁ: 'tsa',
	つぃ: 'tsi',
	つぇ: 'tse',
	つぉ: 'tso',
	てぃ: 'ti',
	でぃ: 'di',
	とぅ: 'tu',
	どぅ: 'du',
	ふぁ: 'fa',
	ふぃ: 'fi',
	ふぇ: 'fe',
	ふぉ: 'fo',
	ゔぁ: 'va',
	ゔぃ: 'vi',
	ゔぇ: 've',
	ゔぉ: 'vo',
};

const KANA_SYLLABLES: Readonly<Record<string, string>> = {
	あ: 'a',
	い: 'i',
	う: 'u',
	え: 'e',
	お: 'o',
	か: 'ka',
	き: 'ki',
	く: 'ku',
	け: 'ke',
	こ: 'ko',
	が: 'ga',
	ぎ: 'gi',
	ぐ: 'gu',
	げ: 'ge',
	ご: 'go',
	さ: 'sa',
	し: 'shi',
	す: 'su',
	せ: 'se',
	そ: 'so',
	ざ: 'za',
	じ: 'ji',
	ず: 'zu',
	ぜ: 'ze',
	ぞ: 'zo',
	た: 'ta',
	ち: 'chi',
	つ: 'tsu',
	て: 'te',
	と: 'to',
	だ: 'da',
	ぢ: 'ji',
	づ: 'zu',
	で: 'de',
	ど: 'do',
	な: 'na',
	に: 'ni',
	ぬ: 'nu',
	ね: 'ne',
	の: 'no',
	は: 'ha',
	ひ: 'hi',
	ふ: 'fu',
	へ: 'he',
	ほ: 'ho',
	ば: 'ba',
	び: 'bi',
	ぶ: 'bu',
	べ: 'be',
	ぼ: 'bo',
	ぱ: 'pa',
	ぴ: 'pi',
	ぷ: 'pu',
	ぺ: 'pe',
	ぽ: 'po',
	ま: 'ma',
	み: 'mi',
	む: 'mu',
	め: 'me',
	も: 'mo',
	や: 'ya',
	ゆ: 'yu',
	よ: 'yo',
	ら: 'ra',
	り: 'ri',
	る: 'ru',
	れ: 're',
	ろ: 'ro',
	わ: 'wa',
	ゐ: 'i',
	ゑ: 'e',
	を: 'o',
	ん: 'n',
	ゔ: 'vu',
	ゕ: 'ka',
	ゖ: 'ke',
	ゎ: 'wa',
};

function toHiragana(value: string): string {
	return value.replace(/[ァ-ヶ]/gu, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

function nextKanaReading(value: string, index: number): string | null {
	const pair = value.slice(index, index + 2);
	return KANA_DIGRAPHS[pair] ?? KANA_SYLLABLES[value[index] ?? ''] ?? null;
}

function kanaToHepburn(value: string): string {
	const kana = toHiragana(value.normalize('NFKC'));
	let result = '';

	for (let index = 0; index < kana.length; index += 1) {
		const character = kana[index]!;
		if (character === 'っ') {
			const next = nextKanaReading(kana, index + 1);
			if (next) result += next.startsWith('ch') ? 't' : next[0];
			continue;
		}
		if (character === 'ー') {
			const lastVowel = result.match(/[aeiou]$/)?.[0];
			if (lastVowel) result += lastVowel;
			continue;
		}

		const pair = KANA_DIGRAPHS[kana.slice(index, index + 2)];
		if (pair) {
			result += pair;
			index += 1;
			continue;
		}

		result += KANA_SYLLABLES[character] ?? character;
	}

	return result;
}

function defaultJapaneseReading(value: string): string {
	return JAPANESE_WORD_READINGS.reduce((current, [word, reading]) => current.replaceAll(word, reading), value);
}

function separateJapaneseAndLatin(value: string): string {
	return value.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}](?=[A-Za-z0-9])/gu, '$& ').replace(/[A-Za-z0-9](?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, '$& ');
}

function hasJapanese(value: string): boolean {
	return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
}

function uniqueCharacters(value: string): string[] {
	return [...new Set(value)].sort((left, right) => left.localeCompare(right, 'ja'));
}

function diagnostic(code: SlugDiagnosticCode, message: string, characters?: string): SlugDiagnostic {
	return characters === undefined ? { code, message } : { code, message, characters };
}

function normalizeSlugText(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-+|-+$/gu, '')
		.replace(/-{2,}/gu, '-');
}

export function analyzeSlugCandidate(displayName: string, options: SlugifyOptions = {}): SlugAnalysis {
	const trimmed = displayName.normalize('NFKC').trim();
	if (!trimmed) {
		return {
			baseSlug: null,
			normalizedValue: '',
			basis: { method: 'unconvertible', source: 'display-name' },
			diagnostics: [diagnostic('empty-display-name', '表示名が空です。'), diagnostic('empty-candidate', 'slug候補が空です。')],
		};
	}

	const japanese = hasJapanese(trimmed);
	const source = options.reading != null ? 'reading' : 'display-name';
	const resolved = japanese ? (options.reading ?? options.resolveJapaneseReading?.(trimmed) ?? defaultJapaneseReading(trimmed)) : trimmed;
	const hepburn = kanaToHepburn(separateJapaneseAndLatin(resolved));
	const asciiValue = hepburn.normalize('NFKD').replace(/\p{M}/gu, '');
	const unsupportedCharacters = uniqueCharacters([...asciiValue].filter((character) => (character.codePointAt(0) ?? 0) > 0x7f).join(''));
	const diagnostics: SlugDiagnostic[] = [];

	if (unsupportedCharacters.length > 0) {
		diagnostics.push(diagnostic('untransliterated-characters', '表示名の一部をローマ字化できません。人手レビューで読みを補ってください。', unsupportedCharacters.join('')));
	}

	const normalizedValue = normalizeSlugText(asciiValue);
	if (!normalizedValue) diagnostics.push(diagnostic('empty-candidate', '正規化後のslug候補が空です。'));

	const method = diagnostics.length > 0 ? 'unconvertible' : japanese && /[a-z]/iu.test(trimmed) ? 'mixed' : japanese ? 'hepburn' : 'kebab-case';
	return {
		baseSlug: diagnostics.length > 0 ? null : normalizedValue,
		normalizedValue,
		basis: { method, source },
		diagnostics,
	};
}

export function slugify(displayName: string, options: SlugifyOptions = {}): string | null {
	return analyzeSlugCandidate(displayName, options).baseSlug;
}

function compareRows(left: SlugSourceRow, right: SlugSourceRow): number {
	const idDifference = left.id.localeCompare(right.id, 'en');
	return idDifference !== 0 ? idDifference : left.displayName.localeCompare(right.displayName, 'ja');
}

function addCollisionDiagnostic(diagnostics: SlugDiagnostic[], baseSlug: string): SlugDiagnostic[] {
	return [...diagnostics, diagnostic('collision', `候補 ${baseSlug} が同種別の別エンティティと衝突します。`)];
}

function prepareRecords(snapshot: SlugSnapshot, options: SlugifyOptions): PreparedRecord[] {
	const prepared: PreparedRecord[] = [];
	for (const entityType of SLUG_ENTITY_TYPES) {
		for (const row of [...snapshot[entityType]].sort(compareRows)) {
			const existingSlug = row.slug === undefined ? null : row.slug;
			if (existingSlug !== null) {
				const diagnostics = existingSlug === '' ? [diagnostic('existing-slug-empty', '既存slugが空文字です。既存値は変更せず、人手レビューに回します。')] : [];
				prepared.push({
					entityType,
					row,
					existingSlug,
					baseSlug: existingSlug || null,
					candidateSlug: existingSlug,
					basis: { method: 'preserved', source: 'display-name' },
					status: diagnostics.length > 0 ? 'needs_review' : 'preserved',
					diagnostics,
					collision: null,
					assignedSuffix: existingSlug ? 1 : null,
				});
				continue;
			}

			const analysisOptions: SlugifyOptions = { ...options };
			if (row.reading !== undefined) analysisOptions.reading = row.reading;
			const analysis = analyzeSlugCandidate(row.displayName, analysisOptions);
			prepared.push({
				entityType,
				row,
				existingSlug: null,
				baseSlug: analysis.baseSlug,
				candidateSlug: analysis.baseSlug,
				basis: analysis.basis,
				status: analysis.baseSlug === null ? 'needs_review' : 'proposed',
				diagnostics: analysis.diagnostics,
				collision: null,
				assignedSuffix: analysis.baseSlug === null ? null : 1,
			});
		}
	}
	return prepared;
}

function assignCandidateSlugs(prepared: PreparedRecord[]): void {
	const occupiedByType = new Map<SlugEntityType, Map<string, string[]>>();
	const baseGroups = new Map<string, PreparedRecord[]>();

	for (const entityType of SLUG_ENTITY_TYPES) occupiedByType.set(entityType, new Map());
	for (const record of prepared) {
		if (!record.baseSlug) continue;
		const groupKey = `${record.entityType}\u0000${record.baseSlug}`;
		const group = baseGroups.get(groupKey) ?? [];
		group.push(record);
		baseGroups.set(groupKey, group);
		if (record.existingSlug) {
			const occupied = occupiedByType.get(record.entityType)!.get(record.existingSlug) ?? [];
			occupied.push(record.row.id);
			occupiedByType.get(record.entityType)!.set(record.existingSlug, occupied);
		}
	}

	for (const record of prepared) {
		if (record.existingSlug !== null || record.baseSlug === null) continue;
		const occupied = occupiedByType.get(record.entityType)!;
		const blockedBy: string[] = [];
		let suffix = 1;
		let candidate = record.baseSlug;
		while (occupied.has(candidate)) {
			blockedBy.push(...occupied.get(candidate)!);
			suffix += 1;
			candidate = `${record.baseSlug}-${suffix}`;
		}
		occupied.set(candidate, [record.row.id]);
		record.candidateSlug = candidate;
		record.assignedSuffix = suffix;

		const group = baseGroups.get(`${record.entityType}\u0000${record.baseSlug}`)!;
		const conflictingEntityIds = [...new Set([...group.map((item) => item.row.id), ...blockedBy])].sort((left, right) => left.localeCompare(right, 'en'));
		if (conflictingEntityIds.length > 1 || suffix > 1) {
			record.collision = {
				detected: true,
				baseSlug: record.baseSlug,
				assignedSuffix: suffix,
				conflictingEntityIds,
			};
			record.diagnostics = addCollisionDiagnostic(record.diagnostics, record.baseSlug);
			record.status = 'needs_review';
		}
	}

	for (const record of prepared) {
		if (!record.baseSlug) continue;
		const group = baseGroups.get(`${record.entityType}\u0000${record.baseSlug}`)!;
		if (group.length <= 1) continue;
		const conflictingEntityIds = group.map((item) => item.row.id).sort((left, right) => left.localeCompare(right, 'en'));
		if (record.collision === null) {
			record.collision = {
				detected: true,
				baseSlug: record.baseSlug,
				assignedSuffix: record.assignedSuffix ?? 1,
				conflictingEntityIds,
			};
			record.diagnostics = addCollisionDiagnostic(record.diagnostics, record.baseSlug);
			record.status = 'needs_review';
		}
	}
}

function toCandidateRecord(record: PreparedRecord): SlugCandidateRecord {
	return {
		entityType: record.entityType,
		id: record.row.id,
		displayName: record.row.displayName,
		existingSlug: record.existingSlug,
		candidateSlug: record.candidateSlug,
		basis: record.basis,
		status: record.status,
		diagnostics: record.diagnostics,
		collision: record.collision,
	};
}

export function buildSlugCandidateArtifact(snapshot: SlugSnapshot, options: SlugifyOptions = {}): SlugCandidateArtifact {
	const prepared = prepareRecords(snapshot, options);
	assignCandidateSlugs(prepared);
	const records = prepared.map(toCandidateRecord);

	return {
		schemaVersion: 1,
		generatedBy: 'scripts/generate_slug_candidates.ts',
		sourceSnapshot: snapshot.sourceSnapshot ?? 'db-snapshot',
		entityTypes: SLUG_ENTITY_TYPES,
		summary: {
			total: records.length,
			proposed: records.filter((record) => record.status === 'proposed').length,
			preserved: records.filter((record) => record.status === 'preserved').length,
			needsReview: records.filter((record) => record.status === 'needs_review').length,
			collisions: records.filter((record) => record.collision !== null).length,
			unresolved: records.filter((record) => record.candidateSlug === null).length,
		},
		records,
	};
}

export function renderSlugCandidateArtifact(artifact: SlugCandidateArtifact): string {
	return `${JSON.stringify(artifact, null, '\t')}\n`;
}

export function parseArgs(argv: string[]): ParsedArgs {
	let input = DEFAULT_INPUT;
	let output = DEFAULT_OUTPUT;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--input' && argv[index + 1]) {
			input = argv[++index]!;
			continue;
		}
		if (arg === '--output' && argv[index + 1]) {
			output = argv[++index]!;
			continue;
		}
		throw new Error(`Unknown or incomplete argument: ${arg}`);
	}

	return { input, output };
}

async function main(): Promise<void> {
	const args = parseArgs(Bun.argv.slice(2));
	const snapshot = JSON.parse(await readFile(args.input, 'utf8')) as SlugSnapshot;
	const artifact = buildSlugCandidateArtifact(snapshot);
	await mkdir(dirname(args.output), { recursive: true });
	await writeFile(args.output, renderSlugCandidateArtifact(artifact), 'utf8');

	console.log(`Wrote ${args.output}`);
	console.log(`Slug candidates: ${artifact.summary.total}`);
	console.log(`Needs review: ${artifact.summary.needsReview}`);
	console.log(`Collisions: ${artifact.summary.collisions}`);
}

if (import.meta.main) await main();
