import { createHash } from 'node:crypto';

export type DatePrecision = 'day' | 'month' | 'uncertain' | 'none';
export type ClassificationSource = 'explicit' | 'inferred' | 'unresolved';
export type ReviewStatus = 'confirmed' | 'inferred' | 'unresolved' | 'not_published';
export type ArticleType = 'interview' | 'column' | 'live_report' | 'review';

export type MagazineRawFields = {
	band: string;
	publication: string;
	issue: string;
	publishedDate: string;
	classification: string;
	content: string;
};

export type MagazineSubject = {
	kind: 'project' | 'person_candidate' | 'unresolved';
	name: string | null;
};

export type MagazineArticleCandidate = {
	articleKey: string;
	title: string;
	type: ArticleType | null;
	candidateTypes: ArticleType[];
	content: string;
	classificationSource: ClassificationSource;
	reviewStatus: ReviewStatus;
	diagnostics: string[];
};

export type MagazineReviewRecord = {
	sourceKey: string;
	rawFields: MagazineRawFields;
	subject: MagazineSubject;
	publication: {
		name: string;
		rawName: string;
		type: 'print';
	};
	issue: {
		issueKey: string;
		issueNumber: string | null;
		volume: string | null;
		publishedDate: string | null;
		datePrecision: DatePrecision;
		synthetic: boolean;
	};
	articles: MagazineArticleCandidate[];
	classificationSource: ClassificationSource;
	reviewStatus: ReviewStatus;
	extracted: {
		pageReferences: string[];
		urls: string[];
		workCandidates: string[];
		eventDateCandidates: string[];
	};
	diagnostics: string[];
};

export type MagazineParseResult = {
	records: MagazineReviewRecord[];
	diagnostics: string[];
};

const EXPECTED_HEADER = ['バンド', '雑誌名', '号数', '発売日', '分類(Interview/Column/Livereport/Review)', '掲載箇所/内容'];

const PROJECT_BY_LABEL = new Map<string, string>([
	['BN', 'BURGER NUDS'],
	['GDHM', 'Good Dog Happy Men'],
	['PtM', 'Poet-type.M'],
	['ソロ', '門田匡陽 (ソロ名義/2010)'],
]);

/**
 * Publication aliases must be curated. Add an entry only after confirming that
 * the two source labels describe the same durable publication.
 */
const PUBLICATION_ALIASES = new Map<string, string>();

const TYPE_BY_CODE = new Map<string, ArticleType>([
	['I', 'interview'],
	['C', 'column'],
	['L', 'live_report'],
	['R', 'review'],
]);

const TYPE_LABEL: Record<ArticleType, string> = {
	interview: 'インタビュー',
	column: 'コラム',
	live_report: 'ライブレポート',
	review: 'レビュー',
};

const TYPE_PATTERNS: Record<ArticleType, RegExp[]> = {
	interview: [/インタビュー/i],
	column: [/コラム/i, /コメント/i, /ARTIST VOICE/i, /メッセージ/i, /アーティスト紹介/i],
	live_report: [/ライブ\s*レポート/i, /LIVE\s*REPORT/i, /LIVEのREPORT/i, /イベント\s*レポート/i],
	review: [/ディスク\s*レビュー/i, /レビュー/i],
};

const NEGATIVE_PATTERN = /みつからず|見つからず|載ってない|掲載なさそう|掲載なし|実際は無し/iu;
const UNCERTAIN_PATTERN = /[?？]|たぶん|不明|説もある|説がある|かもしれ/iu;

function stableKey(namespace: string, value: string): string {
	return createHash('sha1').update(`mondenDatabase/${namespace}/${value}`).digest('hex');
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function normalizeText(value: string): string {
	return value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function normalizePublication(value: string): string {
	const normalized = normalizeText(value);
	return PUBLICATION_ALIASES.get(normalized) ?? normalized;
}

function subjectFor(label: string): MagazineSubject {
	const project = PROJECT_BY_LABEL.get(label);
	if (project) return { kind: 'project', name: project };
	if (label === 'その他') return { kind: 'person_candidate', name: '門田匡陽' };
	return { kind: 'unresolved', name: null };
}

export function parseMagazineDate(rawValue: string): {
	publishedDate: string | null;
	precision: DatePrecision;
} {
	const value = rawValue.trim();
	if (!value) return { publishedDate: null, precision: 'none' };
	if (value.includes('?') || value.includes('？')) {
		return { publishedDate: null, precision: 'uncertain' };
	}

	const dayMatch = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/u);
	if (dayMatch) {
		const year = Number(dayMatch[1]);
		const month = Number(dayMatch[2]);
		const day = Number(dayMatch[3]);
		const date = new Date(Date.UTC(year, month - 1, day));
		if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
			return {
				publishedDate: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
				precision: 'day',
			};
		}
		return { publishedDate: null, precision: 'uncertain' };
	}

	if (/^\d{4}\/\d{1,2}$/u.test(value)) {
		return { publishedDate: null, precision: 'month' };
	}
	return { publishedDate: null, precision: 'uncertain' };
}

function volumeFromIssue(issue: string): string | null {
	const match = issue.match(/^vol\.?\s*(\d+)(?:\s|$|\()/iu);
	return match?.[1] ?? null;
}

function splitContentSegments(content: string): string[] {
	const segments: string[] = [];
	let current = '';
	let depth = 0;
	for (const character of content) {
		if ('([（［【'.includes(character)) depth += 1;
		if (')]）］】'.includes(character)) depth = Math.max(0, depth - 1);
		if (depth === 0 && ['、', '，', ';', '；', '\n'].includes(character)) {
			const value = current.trim();
			if (value) segments.push(value);
			current = '';
			continue;
		}
		current += character;
	}
	const value = current.trim();
	if (value) segments.push(value);
	return segments.length > 0 ? segments : [content];
}

function typesInText(value: string): ArticleType[] {
	return (Object.keys(TYPE_PATTERNS) as ArticleType[]).filter((type) => TYPE_PATTERNS[type].some((pattern) => pattern.test(value)));
}

function explicitTypes(value: string): ArticleType[] | null {
	if (!value.trim()) return null;
	const codes = value
		.split('/')
		.map((code) => code.trim())
		.filter(Boolean);
	const types = codes.map((code) => TYPE_BY_CODE.get(code));
	if (types.some((type) => !type)) return [];
	return types as ArticleType[];
}

function nearestTypeBefore(value: string, index: number): ArticleType | null {
	let nearest: { type: ArticleType; index: number } | null = null;
	for (const type of Object.keys(TYPE_PATTERNS) as ArticleType[]) {
		for (const pattern of TYPE_PATTERNS[type]) {
			const flags = unique([...pattern.flags.replace('g', ''), 'g']).join('');
			for (const match of value.matchAll(new RegExp(pattern.source, flags))) {
				if (match.index >= index) continue;
				if (!nearest || match.index > nearest.index) nearest = { type, index: match.index };
			}
		}
	}
	return nearest?.type ?? null;
}

function patternAppliesToType(pattern: RegExp, content: string, type: ArticleType | null): boolean {
	const match = pattern.exec(content);
	if (!match || match.index == null || !type) return Boolean(match);
	const nearestType = nearestTypeBefore(content, match.index);
	return nearestType == null || nearestType === type;
}

function statusForArticle(type: ArticleType | null, content: string, classificationSource: ClassificationSource, recordUncertain: boolean): ReviewStatus {
	if (patternAppliesToType(NEGATIVE_PATTERN, content, type)) return 'not_published';
	if (recordUncertain || patternAppliesToType(UNCERTAIN_PATTERN, content, type)) {
		return 'unresolved';
	}
	if (classificationSource === 'inferred') return 'inferred';
	if (classificationSource === 'unresolved') return 'unresolved';
	return 'confirmed';
}

function articleTitle(subject: MagazineSubject, type: ArticleType | null): string {
	const subjectName = subject.name ?? '掲載対象未確認';
	return `${subjectName}掲載（${type ? TYPE_LABEL[type] : '要分類'}）`;
}

function makeArticle(
	sourceKey: string,
	index: number,
	subject: MagazineSubject,
	type: ArticleType | null,
	candidateTypes: ArticleType[],
	content: string,
	classificationSource: ClassificationSource,
	recordUncertain: boolean,
	diagnostics: string[] = [],
): MagazineArticleCandidate {
	return {
		articleKey: stableKey('magazine_article', [sourceKey, index, type ?? candidateTypes.join('/'), content].join('\u001f')),
		title: articleTitle(subject, type),
		type,
		candidateTypes,
		content,
		classificationSource,
		reviewStatus: statusForArticle(type, content, classificationSource, recordUncertain),
		diagnostics,
	};
}

function articlesFor(
	raw: MagazineRawFields,
	sourceKey: string,
	subject: MagazineSubject,
	recordUncertain: boolean,
): {
	articles: MagazineArticleCandidate[];
	classificationSource: ClassificationSource;
	diagnostics: string[];
} {
	const declaredTypes = explicitTypes(raw.classification);
	const segments = splitContentSegments(raw.content);
	const diagnostics: string[] = [];

	if (declaredTypes && declaredTypes.length === 1) {
		const [type] = declaredTypes;
		return {
			articles: [makeArticle(sourceKey, 0, subject, type!, [type!], raw.content, 'explicit', recordUncertain)],
			classificationSource: 'explicit',
			diagnostics,
		};
	}

	if (declaredTypes && declaredTypes.length > 1) {
		const usedSegments = new Set<number>();
		const resolved = declaredTypes.map((type) => {
			const matching = segments
				.map((segment, index) => ({ segment, index, types: typesInText(segment) }))
				.filter((candidate) => candidate.types.length === 1 && candidate.types[0] === type && !usedSegments.has(candidate.index));
			if (matching.length !== 1) return null;
			usedSegments.add(matching[0]!.index);
			return matching[0]!.segment;
		});
		if (resolved.every((segment): segment is string => segment != null)) {
			return {
				articles: declaredTypes.map((type, index) => makeArticle(sourceKey, index, subject, type, [type], resolved[index]!, 'explicit', recordUncertain)),
				classificationSource: 'explicit',
				diagnostics,
			};
		}

		diagnostics.push('ambiguous_multi_classification');
		return {
			articles: [makeArticle(sourceKey, 0, subject, null, declaredTypes, raw.content, 'unresolved', true, ['requires_article_split_review'])],
			classificationSource: 'unresolved',
			diagnostics,
		};
	}

	if (declaredTypes?.length === 0) {
		diagnostics.push('unsupported_classification');
		return {
			articles: [makeArticle(sourceKey, 0, subject, null, [], raw.content, 'unresolved', true, ['requires_classification_review'])],
			classificationSource: 'unresolved',
			diagnostics,
		};
	}

	const inferredBySegment = segments.map((segment) => ({ segment, types: typesInText(segment) })).filter((candidate) => candidate.types.length === 1);
	if (inferredBySegment.length > 0) {
		diagnostics.push('classification_inferred_from_content');
		return {
			articles: inferredBySegment.map((candidate, index) => {
				const type = candidate.types[0]!;
				return makeArticle(sourceKey, index, subject, type, [type], candidate.segment, 'inferred', recordUncertain);
			}),
			classificationSource: 'inferred',
			diagnostics,
		};
	}

	diagnostics.push('missing_classification');
	return {
		articles: [makeArticle(sourceKey, 0, subject, null, [], raw.content, 'unresolved', true, ['requires_classification_review'])],
		classificationSource: 'unresolved',
		diagnostics,
	};
}

function reviewStatusFor(articles: MagazineArticleCandidate[]): ReviewStatus {
	const statuses = unique(articles.map((article) => article.reviewStatus));
	if (statuses.length > 1) return 'unresolved';
	return articles[0]?.reviewStatus ?? 'unresolved';
}

function extractMetadata(content: string): MagazineReviewRecord['extracted'] {
	const pageReferences = [...content.matchAll(/(?:\d+\/\d+|\d+(?:-\d+)?)\s*p\b/giu)].map((match) => match[0].replace(/\s+/gu, ''));
	const urls = [...content.matchAll(/https?:\/\/[^\s)]+/giu)].map((match) => match[0]);
	const workCandidates = [...content.matchAll(/(?:ディスク\s*レビュー|レビュー)\s*[（(]([^）)]+)[）)]/giu)].map((match) => match[1]!.trim());
	const eventDateCandidates = [...content.matchAll(/\b\d{2,4}\/\d{1,2}\/\d{1,2}\b/gu)].map((match) => match[0]);
	return {
		pageReferences: unique(pageReferences),
		urls: unique(urls),
		workCandidates: unique(workCandidates),
		eventDateCandidates: unique(eventDateCandidates),
	};
}

function rawFieldsFromColumns(columns: string[]): MagazineRawFields {
	return {
		band: columns[0] ?? '',
		publication: columns[1] ?? '',
		issue: columns[2] ?? '',
		publishedDate: columns[3] ?? '',
		classification: columns[4] ?? '',
		content: columns.slice(5).join('\t'),
	};
}

function rawIdentity(raw: MagazineRawFields): string {
	return [raw.band, raw.publication, raw.issue, raw.publishedDate, raw.classification, raw.content].join('\u001f');
}

function recordFromRaw(raw: MagazineRawFields, duplicateOccurrence: number): MagazineReviewRecord {
	const sourceKey = stableKey('magazine_source', `${rawIdentity(raw)}\u001fduplicate_occurrence=${duplicateOccurrence}`);
	const subject = subjectFor(raw.band);
	const publicationName = normalizePublication(raw.publication);
	const date = parseMagazineDate(raw.publishedDate);
	const synthetic = !raw.issue.trim() && !raw.publishedDate.trim();
	const recordUncertain = date.precision === 'uncertain' || UNCERTAIN_PATTERN.test(raw.issue) || subject.kind === 'unresolved' || synthetic;
	const issueIdentity = synthetic ? `synthetic\u001f${sourceKey}` : [publicationName, normalizeText(raw.issue), normalizeText(raw.publishedDate)].join('\u001f');
	const articleResult = articlesFor(raw, sourceKey, subject, recordUncertain);
	const diagnostics = [...articleResult.diagnostics];
	if (date.precision === 'month') diagnostics.push('month_precision_date');
	if (date.precision === 'uncertain') diagnostics.push('uncertain_date');
	if (synthetic) diagnostics.push('synthetic_issue_requires_review');
	if (subject.kind === 'person_candidate') diagnostics.push('person_mention_requires_review');
	if (subject.kind === 'unresolved') diagnostics.push('unknown_subject_label');
	if (duplicateOccurrence > 1) diagnostics.push(`duplicate_raw_row:${duplicateOccurrence}`);

	return {
		sourceKey,
		rawFields: raw,
		subject,
		publication: {
			name: publicationName,
			rawName: raw.publication,
			type: 'print',
		},
		issue: {
			issueKey: stableKey('magazine_issue', issueIdentity),
			issueNumber: raw.issue.trim() || null,
			volume: volumeFromIssue(raw.issue),
			publishedDate: date.publishedDate,
			datePrecision: date.precision,
			synthetic,
		},
		articles: articleResult.articles,
		classificationSource: articleResult.classificationSource,
		reviewStatus: reviewStatusFor(articleResult.articles),
		extracted: extractMetadata(raw.content),
		diagnostics,
	};
}

export function parseMagazineTsv(source: string): MagazineParseResult {
	const normalized = source
		.replace(/^\uFEFF/u, '')
		.replaceAll('\r\n', '\n')
		.replaceAll('\r', '\n');
	const lines = normalized.split('\n');
	if (lines.at(-1) === '') lines.pop();
	const diagnostics: string[] = [];
	const header = (lines.shift() ?? '').split('\t');
	if (header.length !== EXPECTED_HEADER.length || header.some((value, index) => value !== EXPECTED_HEADER[index])) {
		diagnostics.push('unexpected_header');
	}

	const duplicateOccurrences = new Map<string, number>();
	const records = lines
		.filter((line, index) => {
			if (line.length > 0) return true;
			diagnostics.push(`blank_row:${index + 2}`);
			return false;
		})
		.map((line, index) => {
			const columns = line.split('\t');
			if (columns.length !== 6) diagnostics.push(`column_count:${index + 2}:${columns.length}`);
			const raw = rawFieldsFromColumns(columns);
			const identity = rawIdentity(raw);
			const occurrence = (duplicateOccurrences.get(identity) ?? 0) + 1;
			duplicateOccurrences.set(identity, occurrence);
			return recordFromRaw(raw, occurrence);
		});

	return { records, diagnostics };
}
