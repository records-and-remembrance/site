import { asc, eq } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import type { AdminDb, RelatedLoader } from '../types';

export const createEventRelatedLoader =
	(database: AdminDb): RelatedLoader =>
	async (eventId) => {
		const performances = await database
			.select({
				id: schema.eventPerformance.id,
				compositionId: schema.eventPerformance.compositionId,
				compositionTitle: schema.composition.title,
				orderIndex: schema.eventPerformance.orderIndex,
				encore: schema.eventPerformance.encore,
				variationNote: schema.eventPerformance.variationNote,
				notes: schema.eventPerformance.notes,
			})
			.from(schema.eventPerformance)
			.innerJoin(schema.composition, eq(schema.composition.id, schema.eventPerformance.compositionId))
			.where(eq(schema.eventPerformance.eventId, eventId))
			.orderBy(asc(schema.eventPerformance.orderIndex));

		return { performances };
	};
