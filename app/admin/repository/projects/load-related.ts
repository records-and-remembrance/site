import { asc, desc, eq, sql } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import type { AdminDb, RelatedLoader } from '../types';

export const createProjectRelatedLoader =
	(database: AdminDb): RelatedLoader =>
	async (projectId) => {
		const [members, works, events] = await Promise.all([
			database
				.select({
					id: schema.membership.id,
					personId: schema.membership.personId,
					personName: schema.person.name,
					fromDate: schema.membership.fromDate,
					toDate: schema.membership.toDate,
					support: schema.membership.support,
					note: schema.membership.note,
				})
				.from(schema.membership)
				.innerJoin(schema.person, eq(schema.person.id, schema.membership.personId))
				.where(eq(schema.membership.projectId, projectId))
				.orderBy(desc(schema.membership.fromDate), asc(schema.person.name)),
			database
				.select({
					id: schema.work.id,
					title: schema.work.title,
					releasedDate: schema.work.releasedDate,
				})
				.from(schema.work)
				.where(eq(schema.work.projectId, projectId))
				.orderBy(sql`${schema.work.releasedDate} desc nulls last`, asc(schema.work.title)),
			database
				.select({
					id: schema.event.id,
					eventName: schema.event.eventName,
					eventDate: schema.event.eventDate,
					venueName: schema.venue.name,
				})
				.from(schema.event)
				.innerJoin(schema.venue, eq(schema.venue.id, schema.event.venueId))
				.where(eq(schema.event.projectId, projectId))
				.orderBy(desc(schema.event.eventDate)),
		]);

		return { members, works, events };
	};
