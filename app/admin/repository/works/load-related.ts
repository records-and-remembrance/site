import { asc, eq, inArray, sql } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import type { AdminDb, RelatedLoader } from '../types';

export const createWorkRelatedLoader =
	(database: AdminDb): RelatedLoader =>
	async (workId) => {
		const [releases, tracks, projects] = await Promise.all([
			database
				.select({
					id: schema.release.id,
					format: schema.release.format,
					catalogNumber: schema.release.catalogNumber,
					releaseDate: schema.release.releaseDate,
					releaseDatePrecision: schema.release.releaseDatePrecision,
					recordedFrom: schema.release.recordedFrom,
					recordedTo: schema.release.recordedTo,
					description: schema.release.description,
					notes: schema.release.notes,
					distributorId: schema.release.distributorId,
					distributorName: schema.distributor.name,
					editionType: schema.release.editionType,
					reissueOfReleaseId: schema.release.reissueOfReleaseId,
				})
				.from(schema.release)
				.leftJoin(schema.distributor, eq(schema.distributor.id, schema.release.distributorId))
				.where(eq(schema.release.workId, workId))
				.orderBy(sql`${schema.release.releaseDate} desc nulls last`, asc(schema.release.format)),
			database
				.select({
					id: schema.track.id,
					releaseId: schema.track.releaseId,
					format: schema.release.format,
					trackNumber: schema.track.trackNumber,
					recordingId: schema.recording.id,
					compositionId: schema.composition.id,
					compositionTitle: schema.composition.title,
					notes: schema.track.notes,
				})
				.from(schema.track)
				.innerJoin(schema.release, eq(schema.release.id, schema.track.releaseId))
				.innerJoin(schema.recording, eq(schema.recording.id, schema.track.recordingId))
				.innerJoin(schema.composition, eq(schema.composition.id, schema.recording.compositionId))
				.where(eq(schema.release.workId, workId))
				.orderBy(asc(schema.release.releaseDate), asc(schema.release.format), asc(schema.track.trackNumber)),
			database
				.select({
					id: schema.workProject.id,
					workId: schema.workProject.workId,
					projectId: schema.workProject.projectId,
					projectName: schema.project.name,
					relationType: schema.workProject.relationType,
				})
				.from(schema.workProject)
				.innerJoin(schema.project, eq(schema.project.id, schema.workProject.projectId))
				.where(eq(schema.workProject.workId, workId))
				.orderBy(asc(schema.project.name)),
		]);

		if (releases.length === 0) return { projects, releases: [], tracks };

		const labelRelations = await database
			.select({
				id: schema.labelRelation.id,
				releaseId: schema.labelRelation.releaseId,
				labelId: schema.label.id,
				name: schema.label.name,
			})
			.from(schema.labelRelation)
			.innerJoin(schema.label, eq(schema.label.id, schema.labelRelation.labelId))
			.where(
				inArray(
					schema.labelRelation.releaseId,
					releases.map((release) => release.id),
				),
			)
			.orderBy(asc(schema.label.name));

		const labelsByRelease = Map.groupBy(labelRelations, (labelRelation) => labelRelation.releaseId);
		return {
			projects,
			releases: releases.map((release) => ({
				...release,
				labels: labelsByRelease.get(release.id) ?? [],
			})),
			tracks,
		};
	};
