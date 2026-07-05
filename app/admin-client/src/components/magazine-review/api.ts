import type { MagazineReviewDataset, MagazineReviewDecision, MagazineReviewDecisionInput } from '../../../../magazine-review/types';
import { request } from '../../api';

export async function getMagazineReviewDataset(): Promise<MagazineReviewDataset> {
	const response = await request<{ data: MagazineReviewDataset }>('/api/magazine-review');
	return response.data;
}

export async function saveMagazineReviewDecision(sourceKey: string, input: MagazineReviewDecisionInput): Promise<MagazineReviewDecision> {
	const response = await request<{ data: MagazineReviewDecision }>(`/api/magazine-review/records/${sourceKey}/decision`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input),
	});
	return response.data;
}
