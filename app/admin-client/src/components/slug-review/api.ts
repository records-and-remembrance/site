import type { SlugEntityType } from '../../../../../scripts/generate_slug_candidates';
import type { SlugReviewArtifact, SlugReviewDataset, SlugReviewDecision, SlugReviewDecisionInput } from '../../../../slug-review/types';
import { request } from '../../api';

export async function getSlugReviewDataset(): Promise<SlugReviewDataset> {
	const response = await request<{ data: SlugReviewDataset }>('/api/slug-review');
	return response.data;
}

export async function saveSlugReviewDecision(entityType: SlugEntityType, id: string, input: SlugReviewDecisionInput): Promise<SlugReviewDecision> {
	const response = await request<{ data: SlugReviewDecision }>(`/api/slug-review/records/${entityType}/${id}/decision`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input),
	});
	return response.data;
}

export async function getSlugReviewArtifact(): Promise<SlugReviewArtifact> {
	const response = await request<{ data: SlugReviewArtifact }>('/api/slug-review/artifact');
	return response.data;
}
