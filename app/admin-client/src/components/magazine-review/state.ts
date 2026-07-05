import type { HumanReviewStatus, MagazineReviewListRecord } from '../../../../magazine-review/types';
import type { ReviewStatus } from '../../../../../scripts/lib/magazineTsv';

export interface MagazineReviewFilter {
	search: string;
	parseStatus: ReviewStatus | 'all';
	humanStatus: HumanReviewStatus | 'all';
}

function searchableText(record: MagazineReviewListRecord): string {
	return [
		record.rawFields.band,
		record.rawFields.publication,
		record.rawFields.issue,
		record.rawFields.publishedDate,
		record.rawFields.classification,
		record.rawFields.content,
		record.subject.name,
		record.publication.name,
		...record.articles.flatMap((article) => [article.title, article.content]),
	].join(' ');
}

export function filterMagazineReviewRecords(records: MagazineReviewListRecord[], filter: MagazineReviewFilter): MagazineReviewListRecord[] {
	const words = filter.search.normalize('NFKC').toLocaleLowerCase('ja').split(/\s+/).filter(Boolean);
	return records.filter((record) => {
		if (filter.parseStatus !== 'all' && record.reviewStatus !== filter.parseStatus) return false;
		if (filter.humanStatus !== 'all' && record.humanReview.status !== filter.humanStatus) return false;
		if (words.length === 0) return true;
		const haystack = searchableText(record).normalize('NFKC').toLocaleLowerCase('ja');
		return words.every((word) => haystack.includes(word));
	});
}

export function nextPendingMagazineRecord(records: MagazineReviewListRecord[], currentSourceKey: string | undefined): string | undefined {
	const currentIndex = currentSourceKey ? records.findIndex(({ sourceKey }) => sourceKey === currentSourceKey) : -1;
	const following = records.slice(currentIndex + 1).find(({ humanReview }) => humanReview.status === 'pending');
	if (following) return following.sourceKey;
	return records.slice(0, Math.max(currentIndex, 0)).find(({ humanReview }) => humanReview.status === 'pending')?.sourceKey;
}
