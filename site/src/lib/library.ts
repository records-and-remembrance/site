import type { SiteDatabaseRows, SiteRow } from '../../export/export';

export type LibraryRows = Pick<SiteDatabaseRows, 'publication' | 'publicationIssue' | 'article'>;

export type LibraryArticle = {
	title: string;
	anchor?: string;
	type?: string;
	publishedDate?: string;
	summary?: string;
	content?: string;
	url?: string;
};

export type LibraryIssue = {
	issueNumber?: string;
	volume?: string;
	publishedDate?: string;
	description?: string;
	anchor?: string;
	articles: LibraryArticle[];
};

export type LibraryPublication = {
	name: string;
	type?: string;
	publisher?: string;
	description?: string;
	anchor?: string;
	issues: LibraryIssue[];
};

const textValue = (value: unknown): string | undefined => {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
};

const rowId = (row: SiteRow): string => textValue(row.id) ?? '';

const sortRows = (left: SiteRow, right: SiteRow): number => {
	const leftKey = textValue(left.libraryKey) ?? '';
	const rightKey = textValue(right.libraryKey) ?? '';
	return `${leftKey}\u0000${rowId(left)}`.localeCompare(`${rightKey}\u0000${rowId(right)}`, 'ja');
};

const toOptionalString = (row: SiteRow, field: string): string | undefined => textValue(row[field]);

export const libraryAnchor = (kind: 'publication' | 'issue' | 'article', libraryKey: unknown): string | undefined => {
	const key = textValue(libraryKey);
	return key ? `${kind}-${key}` : undefined;
};

export const buildLibraryTree = (rows: LibraryRows): LibraryPublication[] => {
	const issuesByPublication = new Map<string, SiteRow[]>();
	for (const row of rows.publicationIssue) {
		const publicationId = textValue(row.publicationId);
		if (!publicationId) continue;
		const issues = issuesByPublication.get(publicationId) ?? [];
		issues.push(row);
		issuesByPublication.set(publicationId, issues);
	}

	const articlesByIssue = new Map<string, SiteRow[]>();
	for (const row of rows.article) {
		const issueId = textValue(row.publicationIssueId);
		if (!issueId) continue;
		const articles = articlesByIssue.get(issueId) ?? [];
		articles.push(row);
		articlesByIssue.set(issueId, articles);
	}

	return [...rows.publication].sort(sortRows).map((publication) => {
		const publicationId = rowId(publication);
		const issues = [...(issuesByPublication.get(publicationId) ?? [])].sort(sortRows).map((issue) => {
			const issueId = rowId(issue);
			const articles = [...(articlesByIssue.get(issueId) ?? [])].sort(sortRows).map(
				(article) =>
					({
						title: textValue(article.title) ?? '記事',
						anchor: libraryAnchor('article', article.libraryKey),
						type: toOptionalString(article, 'type'),
						publishedDate: toOptionalString(article, 'publishedDate'),
						summary: toOptionalString(article, 'summary'),
						content: toOptionalString(article, 'content'),
						url: toOptionalString(article, 'url'),
					}) satisfies LibraryArticle,
			);

			return {
				issueNumber: toOptionalString(issue, 'issueNumber'),
				volume: toOptionalString(issue, 'volume'),
				publishedDate: toOptionalString(issue, 'publishedDate'),
				description: toOptionalString(issue, 'description'),
				anchor: libraryAnchor('issue', issue.libraryKey),
				articles,
			} satisfies LibraryIssue;
		});

		return {
			name: textValue(publication.name) ?? '媒体',
			type: toOptionalString(publication, 'type'),
			publisher: toOptionalString(publication, 'publisher'),
			description: toOptionalString(publication, 'description'),
			anchor: libraryAnchor('publication', publication.libraryKey),
			issues,
		} satisfies LibraryPublication;
	});
};
