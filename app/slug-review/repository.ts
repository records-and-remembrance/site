import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SlugCandidateArtifact, SlugEntityType } from '../../scripts/generate_slug_candidates';
import type { SlugReviewArtifact, SlugReviewDecision, SlugReviewDecisionInput, SlugReviewDataset, SlugReviewListRecord, SlugReviewRepository, SlugReviewStatus } from './types';

export interface SlugReviewRepositoryPaths {
	candidatePath: string;
	decisionsPath: string;
	sourceCandidateArtifact?: string;
}

interface DecisionFile extends SlugReviewArtifact {
	schemaVersion: 1;
}

const EMPTY_DECISIONS: DecisionFile = {
	schemaVersion: 1,
	sourceCandidateArtifact: 'drafts/slugs/slug-candidates.json',
	decisions: [],
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function readDecisions(path: string, sourceCandidateArtifact: string): Promise<DecisionFile> {
	try {
		const value = await readJson<DecisionFile>(path);
		return { ...value, sourceCandidateArtifact: value.sourceCandidateArtifact || sourceCandidateArtifact };
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
			return { ...EMPTY_DECISIONS, sourceCandidateArtifact };
		}
		throw error;
	}
}

function decisionKey(entityType: SlugEntityType, id: string): string {
	return `${entityType}:${id}`;
}

function reviewState(record: SlugReviewListRecord, decision: SlugReviewDecision | undefined): SlugReviewListRecord['review'] {
	return decision ? { status: decision.status, slug: decision.slug } : { status: 'pending', slug: record.aiSuggestedSlug ?? record.candidateSlug };
}

function countReviewStatuses(statuses: SlugReviewStatus[]): Record<SlugReviewStatus, number> {
	const counts: Record<SlugReviewStatus, number> = { pending: 0, approved: 0, rejected: 0 };
	for (const status of statuses) counts[status] += 1;
	return counts;
}

function validateDecision(entityType: SlugEntityType, id: string, input: SlugReviewDecisionInput): void {
	if (input.status === 'approved' && (!input.slug || !SLUG_PATTERN.test(input.slug))) {
		throw new Error(`Approved slug is invalid: ${decisionKey(entityType, id)}`);
	}
	if (input.status === 'rejected' && input.slug !== null) {
		throw new Error(`Rejected slug must be null: ${decisionKey(entityType, id)}`);
	}
}

async function writeDecisions(path: string, value: DecisionFile): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temporaryPath = `${path}.tmp`;
	await writeFile(temporaryPath, `${JSON.stringify(value, null, '\t')}\n`, 'utf8');
	await rename(temporaryPath, path);
}

export function createSlugReviewRepository(paths: SlugReviewRepositoryPaths): SlugReviewRepository {
	const sourceCandidateArtifact = paths.sourceCandidateArtifact ?? 'drafts/slugs/slug-candidates.json';

	const readCandidateArtifact = async (): Promise<SlugCandidateArtifact> => await readJson<SlugCandidateArtifact>(paths.candidatePath);

	const get = async (): Promise<SlugReviewDataset> => {
		const [artifact, decisionFile] = await Promise.all([readCandidateArtifact(), readDecisions(paths.decisionsPath, sourceCandidateArtifact)]);
		const decisions = new Map(decisionFile.decisions.map((decision) => [decisionKey(decision.entityType, decision.id), decision]));
		const records = artifact.records.map((record) => {
			const withReview = { ...record, review: { status: 'pending' as const, slug: record.candidateSlug } };
			return { ...withReview, review: reviewState(withReview, decisions.get(decisionKey(record.entityType, record.id))) };
		});
		return {
			summary: artifact.summary,
			meta: { reviewStatuses: countReviewStatuses(records.map(({ review }) => review.status)) },
			records,
		};
	};

	const saveDecision = async (entityType: SlugEntityType, id: string, input: SlugReviewDecisionInput): Promise<SlugReviewDecision> => {
		validateDecision(entityType, id, input);
		const artifact = await readCandidateArtifact();
		if (!artifact.records.some((record) => record.entityType === entityType && record.id === id)) {
			throw new Error('Slug review record was not found');
		}
		const storedDecision: SlugReviewDecision = { entityType, id, ...input };
		const decisions = await readDecisions(paths.decisionsPath, sourceCandidateArtifact);
		const nextDecisions = decisions.decisions.filter((item) => decisionKey(item.entityType, item.id) !== decisionKey(entityType, id));
		await writeDecisions(paths.decisionsPath, {
			schemaVersion: 1,
			sourceCandidateArtifact: decisions.sourceCandidateArtifact,
			decisions: [...nextDecisions, storedDecision],
			...(decisions.redirects ? { redirects: decisions.redirects } : {}),
		});
		return storedDecision;
	};

	const getArtifact = async (): Promise<SlugReviewArtifact> => {
		const decisions = await readDecisions(paths.decisionsPath, sourceCandidateArtifact);
		return {
			schemaVersion: 1,
			sourceCandidateArtifact: decisions.sourceCandidateArtifact,
			decisions: decisions.decisions,
			...(decisions.redirects ? { redirects: decisions.redirects } : {}),
		};
	};

	return { get, saveDecision, getArtifact };
}
