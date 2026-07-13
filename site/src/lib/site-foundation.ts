export type SiteEntityType = 'project' | 'person' | 'composition' | 'work' | 'venue' | 'event';
export type DatePrecision = 'year' | 'month' | 'day' | 'uncertain' | null | undefined;

export type AdjacentLink = {
	label: string;
	href?: string;
};

export type ArtworkInput = {
	url: string | null;
	width: number | null;
	height: number | null;
};

export type ArtworkDisplay = { kind: 'image'; src: string; width: number; height: number } | { kind: 'fallback' };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ENTITY_ROUTE: Record<SiteEntityType, string> = {
	project: '/projects',
	person: '/people',
	composition: '/songs',
	work: '/discography',
	venue: '/venues',
	event: '/lives',
};

export const buildEntityHref = (entityType: SiteEntityType, slug: string | null | undefined): string | undefined => {
	if (!slug || !SLUG_PATTERN.test(slug)) return undefined;
	return `${ENTITY_ROUTE[entityType]}/${slug}`;
};

export const formatDateText = (value: string | null | undefined, precision: DatePrecision): string | undefined => {
	if (!value) return undefined;
	const parts = value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/u);
	if (!parts) return undefined;
	const [, year, month, day] = parts;
	if (!year) return undefined;
	if (month && (!day || !isValidCalendarDate(value))) {
		if (day) return undefined;
		const monthNumber = Number(month);
		if (monthNumber < 1 || monthNumber > 12) return undefined;
	}
	if (!month || precision === 'year') return `${year}年`;
	if (precision === 'month') return `${year}年${Number(month)}月`;
	if (precision !== null && precision !== undefined && precision !== 'day' && precision !== 'uncertain') return undefined;
	return day ? `${year}年${Number(month)}月${Number(day)}日` : `${year}年${Number(month)}月`;
};

export const buildArtworkDisplay = (artwork: ArtworkInput, options: { allowedOrigins: readonly string[]; transformOrigin?: string; width?: number }): ArtworkDisplay => {
	if (!artwork.url || !Number.isInteger(artwork.width) || !Number.isInteger(artwork.height) || artwork.width <= 0 || artwork.height <= 0) return { kind: 'fallback' };
	try {
		const url = new URL(artwork.url);
		if (url.protocol !== 'https:' || !options.allowedOrigins.includes(url.origin)) return { kind: 'fallback' };
		const src =
			options.transformOrigin && options.width && Number.isInteger(options.width) && options.width > 0
				? `${options.transformOrigin.replace(/\/$/u, '')}/cdn-cgi/image/width=${options.width}/${encodeURIComponent(artwork.url)}`
				: artwork.url;
		return { kind: 'image', src, width: artwork.width, height: artwork.height };
	} catch {
		return { kind: 'fallback' };
	}
};

export const normalizeAdjacentLinks = (links: readonly AdjacentLink[]): AdjacentLink[] => {
	const seen = new Set<string>();
	const result: AdjacentLink[] = [];
	for (const link of links) {
		if (!link.href || seen.has(link.href)) continue;
		seen.add(link.href);
		result.push({ label: link.label, href: link.href });
	}
	return result;
};

function isValidCalendarDate(value: string): boolean {
	const parts = value.split('-').map(Number);
	if (parts.length !== 3) return false;
	const [year, month, day] = parts;
	if (!year || !month || !day || month < 1 || month > 12 || day < 1) return false;
	const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return day <= daysInMonth;
}
