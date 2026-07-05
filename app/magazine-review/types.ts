import type { ClassificationSource, MagazineReviewRecord, ReviewStatus } from '../../scripts/lib/magazineTsv';

export const humanReviewDecisionStatuses = ['approved', 'needs_changes', 'excluded'] as const;
export type HumanReviewDecisionStatus = (typeof humanReviewDecisionStatuses)[number];
export type HumanReviewStatus = 'pending' | HumanReviewDecisionStatus;

export interface HumanReview {
	status: HumanReviewStatus;
	notes: string;
	updatedAt: string | null;
}

export interface MagazineReviewDecisionInput {
	status: HumanReviewDecisionStatus;
	notes: string;
}

export interface MagazineReviewDecision extends MagazineReviewDecisionInput {
	sourceKey: string;
	updatedAt: string;
}

export type MagazineReviewListRecord = MagazineReviewRecord & {
	humanReview: HumanReview;
};

export interface MagazineReviewDataset {
	summary: {
		sourceRows: number;
		articleCandidates: number;
		reviewStatuses: Record<ReviewStatus, number>;
		classificationSources: Record<ClassificationSource, number>;
		parserDiagnostics: string[];
	};
	meta: {
		humanReviewStatuses: Record<HumanReviewStatus, number>;
	};
	records: MagazineReviewListRecord[];
}

export interface MagazineReviewRepository {
	get(): Promise<MagazineReviewDataset>;
	saveDecision(sourceKey: string, input: MagazineReviewDecisionInput): Promise<MagazineReviewDecision>;
}
