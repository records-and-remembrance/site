import type { SlugReviewListRecord, SlugReviewStatus } from '../../../../slug-review/types';

export interface SlugReviewFilter {
	search: string;
	candidateStatus: SlugReviewListRecord['status'] | 'all';
	reviewStatus: SlugReviewStatus | 'all';
}

function recordKey(record: Pick<SlugReviewListRecord, 'entityType' | 'id'>): string {
	return `${record.entityType}:${record.id}`;
}

function searchableText(record: SlugReviewListRecord): string {
	return [record.entityType, record.id, record.displayName, record.existingSlug, record.candidateSlug, ...record.diagnostics.flatMap(({ code, message, characters }) => [code, message, characters])]
		.filter(Boolean)
		.join(' ')
		.toLocaleLowerCase();
}

export function filterSlugReviewRecords(records: SlugReviewListRecord[], filter: SlugReviewFilter): SlugReviewListRecord[] {
	const search = filter.search.trim().toLocaleLowerCase();
	return records.filter((record) => {
		if (filter.candidateStatus !== 'all' && record.status !== filter.candidateStatus) return false;
		if (filter.reviewStatus !== 'all' && record.review.status !== filter.reviewStatus) return false;
		return !search || searchableText(record).includes(search);
	});
}

export function nextPendingSlugReviewRecord(records: SlugReviewListRecord[], currentKey?: string): string | undefined {
	const pending = records.filter((record) => record.review.status === 'pending');
	if (pending.length === 0) return undefined;
	const currentIndex = pending.findIndex((record) => recordKey(record) === currentKey);
	const next = pending[currentIndex + 1];
	return next ? recordKey(next) : undefined;
}

export function slugReviewDefaultSlug(record: Pick<SlugReviewListRecord, 'review' | 'aiSuggestedSlug' | 'candidateSlug'>): string {
	return record.review.slug ?? record.aiSuggestedSlug ?? record.candidateSlug ?? '';
}

export function slugReviewRecordKey(record: Pick<SlugReviewListRecord, 'entityType' | 'id'>): string {
	return recordKey(record);
}
