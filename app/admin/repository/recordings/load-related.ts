import { asc, eq } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import type { AdminDb, RelatedLoader } from '../types';

export const createRecordingRelatedLoader =
	(database: AdminDb): RelatedLoader =>
	async (recordingId) => {
		const releases = await database
			.select({
				id: schema.track.id,
				releaseId: schema.release.id,
				releaseTitle: schema.work.title,
				format: schema.release.format,
				catalogNumber: schema.release.catalogNumber,
				releaseDate: schema.release.releaseDate,
				trackNumber: schema.track.trackNumber,
			})
			.from(schema.track)
			.innerJoin(schema.release, eq(schema.release.id, schema.track.releaseId))
			.innerJoin(schema.work, eq(schema.work.id, schema.release.workId))
			.where(eq(schema.track.recordingId, recordingId))
			.orderBy(asc(schema.release.releaseDate), asc(schema.track.trackNumber));

		return { releases };
	};
