import { asc, eq } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import type { AdminDb, RelatedLoader } from '../types';

export const createReleaseRelatedLoader =
	(database: AdminDb): RelatedLoader =>
	async (releaseId) => {
		const tracks = await database
			.select({
				id: schema.track.id,
				releaseId: schema.track.releaseId,
				recordingId: schema.track.recordingId,
				compositionId: schema.composition.id,
				compositionTitle: schema.composition.title,
				trackNumber: schema.track.trackNumber,
				recordedDate: schema.track.recordedDate,
				notes: schema.track.notes,
			})
			.from(schema.track)
			.innerJoin(schema.recording, eq(schema.recording.id, schema.track.recordingId))
			.innerJoin(schema.composition, eq(schema.composition.id, schema.recording.compositionId))
			.where(eq(schema.track.releaseId, releaseId))
			.orderBy(asc(schema.track.trackNumber));

		return { tracks };
	};
