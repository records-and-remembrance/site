import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { MagazineReviewArtifact } from '../../scripts/generate_magazine_review';
import type { HumanReview, HumanReviewDecisionStatus, HumanReviewStatus, MagazineReviewDataset, MagazineReviewDecision, MagazineReviewDecisionInput, MagazineReviewRepository } from './types';

interface MagazineReviewRepositoryPaths {
	artifactPath: string;
	decisionsPath: string;
}

interface DecisionFile {
	schemaVersion: 1;
	decisions: Record<string, MagazineReviewDecision>;
}

const EMPTY_DECISIONS: DecisionFile = {
	schemaVersion: 1,
	decisions: {},
};

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function readDecisions(path: string): Promise<DecisionFile> {
	try {
		return await readJson<DecisionFile>(path);
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return EMPTY_DECISIONS;
		throw error;
	}
}

function humanReviewFor(decision: MagazineReviewDecision | undefined): HumanReview {
	return decision ? { status: decision.status, notes: decision.notes, updatedAt: decision.updatedAt } : { status: 'pending', notes: '', updatedAt: null };
}

function countHumanStatuses(statuses: HumanReviewStatus[]): Record<HumanReviewStatus, number> {
	const counts: Record<HumanReviewStatus, number> = {
		pending: 0,
		approved: 0,
		needs_changes: 0,
		excluded: 0,
	};
	for (const status of statuses) counts[status] += 1;
	return counts;
}

async function writeDecisions(path: string, value: DecisionFile): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temporaryPath = `${path}.tmp`;
	await writeFile(temporaryPath, `${JSON.stringify(value, null, '\t')}\n`, 'utf8');
	await rename(temporaryPath, path);
}

export function createMagazineReviewRepository(paths: MagazineReviewRepositoryPaths): MagazineReviewRepository {
	const get = async (): Promise<MagazineReviewDataset> => {
		const [artifact, decisions] = await Promise.all([readJson<MagazineReviewArtifact>(paths.artifactPath), readDecisions(paths.decisionsPath)]);
		const records = artifact.records.map((record) => ({
			...record,
			humanReview: humanReviewFor(decisions.decisions[record.sourceKey]),
		}));
		return {
			summary: artifact.summary,
			meta: {
				humanReviewStatuses: countHumanStatuses(records.map(({ humanReview }) => humanReview.status)),
			},
			records,
		};
	};

	const saveDecision = async (sourceKey: string, input: MagazineReviewDecisionInput): Promise<MagazineReviewDecision> => {
		const artifact = await readJson<MagazineReviewArtifact>(paths.artifactPath);
		if (!artifact.records.some((record) => record.sourceKey === sourceKey)) {
			throw new Error('Magazine review record was not found');
		}
		const decisions = await readDecisions(paths.decisionsPath);
		const decision: MagazineReviewDecision = {
			sourceKey,
			status: input.status satisfies HumanReviewDecisionStatus,
			notes: input.notes,
			updatedAt: new Date().toISOString(),
		};
		await writeDecisions(paths.decisionsPath, {
			schemaVersion: 1,
			decisions: { ...decisions.decisions, [sourceKey]: decision },
		});
		return decision;
	};

	return { get, saveDecision };
}
