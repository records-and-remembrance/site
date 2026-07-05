import { eq, sql } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import type { AdminDb, RelatedLoader } from '../types';

export const createCompositionRelatedLoader =
	(database: AdminDb): RelatedLoader =>
	async (compositionId) => {
		const [credits, recordings, releaseAppearances, eventAppearances] = await Promise.all([
			database
				.select({
					id: schema.compositionCredit.id,
					personId: schema.compositionCredit.personId,
					personName: schema.person.name,
					creditType: schema.compositionCredit.creditType,
					orderIndex: schema.compositionCredit.orderIndex,
				})
				.from(schema.compositionCredit)
				.innerJoin(schema.person, eq(schema.person.id, schema.compositionCredit.personId))
				.where(eq(schema.compositionCredit.compositionId, compositionId))
				.orderBy(schema.compositionCredit.creditType, schema.compositionCredit.orderIndex),
			database
				.select({
					id: schema.recording.id,
					recordingYear: schema.recording.recordingYear,
					type: schema.recording.type,
					recordedDate: schema.recording.recordedDate,
					recordedFrom: schema.recording.recordedFrom,
					recordedTo: schema.recording.recordedTo,
					releaseDate: schema.recording.releaseDate,
					notes: schema.recording.notes,
				})
				.from(schema.recording)
				.where(eq(schema.recording.compositionId, compositionId))
				.orderBy(sql`coalesce(${schema.recording.recordedDate}, ${schema.recording.releaseDate}) desc nulls last`),
			database
				.select({
					id: schema.release.id,
					title: schema.work.title,
					format: schema.release.format,
					orderIndex: schema.track.trackNumber,
				})
				.from(schema.recording)
				.innerJoin(schema.track, eq(schema.track.recordingId, schema.recording.id))
				.innerJoin(schema.release, eq(schema.release.id, schema.track.releaseId))
				.innerJoin(schema.work, eq(schema.work.id, schema.release.workId))
				.where(eq(schema.recording.compositionId, compositionId)),
			database
				.select({
					id: schema.event.id,
					eventName: schema.event.eventName,
					eventDate: schema.event.eventDate,
					orderIndex: schema.eventPerformance.orderIndex,
				})
				.from(schema.eventPerformance)
				.innerJoin(schema.event, eq(schema.event.id, schema.eventPerformance.eventId))
				.where(eq(schema.eventPerformance.compositionId, compositionId)),
		]);

		const appearances = [
			...releaseAppearances.map(({ id, title, format, orderIndex }) => ({
				type: 'release',
				id,
				label: `${title} (${format})`,
				orderIndex,
			})),
			...eventAppearances.map(({ id, eventName, eventDate, orderIndex }) => ({
				type: 'event',
				id,
				label: eventName ?? eventDate,
				orderIndex,
			})),
		].sort((left, right) => left.label.localeCompare(right.label, 'ja'));

		return { credits, recordings, appearances };
	};
