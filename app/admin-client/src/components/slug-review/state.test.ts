import { describe, expect, test } from 'bun:test';
import type { SlugReviewListRecord } from '../../../../slug-review/types';
import { filterSlugReviewRecords, nextPendingSlugReviewRecord } from './state';

function record(
	entityType: SlugReviewListRecord['entityType'],
	id: string,
	displayName: string,
	status: SlugReviewListRecord['status'],
	reviewStatus: SlugReviewListRecord['review']['status'],
): SlugReviewListRecord {
	return {
		entityType,
		id,
		displayName,
		existingSlug: null,
		candidateSlug: status === 'proposed' ? `${id}-candidate` : null,
		basis: { method: 'unconvertible', source: 'display-name' },
		status,
		diagnostics: status === 'needs_review' ? [{ code: 'empty-candidate', message: '候補が空です' }] : [],
		collision: null,
		review: { status: reviewStatus, slug: null },
	};
}

const records = [
	record('project', 'one', '門田匡陽', 'needs_review', 'pending'),
	record('person', 'two', 'John Doe', 'proposed', 'pending'),
	record('venue', 'three', '渋谷CLUB', 'needs_review', 'approved'),
];

describe('slug review state', () => {
	test('filters needs-review records by search and review status', () => {
		expect(
			filterSlugReviewRecords(records, {
				search: '門田',
				candidateStatus: 'needs_review',
				reviewStatus: 'pending',
			}).map(({ id }) => id),
		).toEqual(['one']);
	});

	test('returns the next pending record in candidate order', () => {
		expect(nextPendingSlugReviewRecord(records, 'project:one')).toBe('person:two');
		expect(nextPendingSlugReviewRecord(records, 'person:two')).toBeUndefined();
	});
});
