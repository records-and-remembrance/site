import type { SlugCandidateArtifact, SlugCandidateRecord, SlugEntityType } from '../../scripts/generate_slug_candidates';

export const slugReviewDecisionStatuses = ['approved', 'rejected'] as const;
export type SlugReviewDecisionStatus = (typeof slugReviewDecisionStatuses)[number];
export type SlugReviewStatus = 'pending' | SlugReviewDecisionStatus;

export interface SlugReviewDecisionInput {
	status: SlugReviewDecisionStatus;
	slug: string | null;
}

export interface SlugReviewDecision extends SlugReviewDecisionInput {
	entityType: SlugEntityType;
	id: string;
}

export interface SlugReviewRedirect {
	entityType: SlugEntityType;
	id: string;
	from: string;
	to: string;
}

export interface SlugReviewState {
	status: SlugReviewStatus;
	slug: string | null;
}

export type SlugReviewListRecord = SlugCandidateRecord & {
	review: SlugReviewState;
};

export interface SlugReviewArtifact {
	schemaVersion: 1;
	sourceCandidateArtifact: string;
	decisions: readonly SlugReviewDecision[];
	redirects?: readonly SlugReviewRedirect[];
}

export interface SlugReviewDataset {
	summary: SlugCandidateArtifact['summary'];
	meta: {
		reviewStatuses: Record<SlugReviewStatus, number>;
	};
	records: SlugReviewListRecord[];
}

export interface SlugReviewRepository {
	get(): Promise<SlugReviewDataset>;
	saveDecision(entityType: SlugEntityType, id: string, input: SlugReviewDecisionInput): Promise<SlugReviewDecision>;
	getArtifact(): Promise<SlugReviewArtifact>;
}
