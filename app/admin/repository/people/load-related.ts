import { asc, desc, eq, inArray } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import type { AdminDb, RelatedLoader } from '../types';

export const createPeopleRelatedLoader =
	(database: AdminDb): RelatedLoader =>
	async (personId) => {
		const memberships = await database
			.select({
				id: schema.membership.id,
				projectId: schema.membership.projectId,
				projectName: schema.project.name,
				fromDate: schema.membership.fromDate,
				toDate: schema.membership.toDate,
				fromDatePrecision: schema.membership.fromDatePrecision,
				toDatePrecision: schema.membership.toDatePrecision,
				support: schema.membership.support,
				note: schema.membership.note,
			})
			.from(schema.membership)
			.innerJoin(schema.project, eq(schema.project.id, schema.membership.projectId))
			.where(eq(schema.membership.personId, personId))
			.orderBy(desc(schema.membership.fromDate));

		if (memberships.length === 0) return { memberships: [] };

		const membershipRoles = await database
			.select({
				id: schema.membershipRole.id,
				membershipId: schema.membershipRole.membershipId,
				roleId: schema.role.id,
				roleName: schema.role.name,
				instrumentId: schema.instrument.id,
				instrumentName: schema.instrument.name,
			})
			.from(schema.membershipRole)
			.innerJoin(schema.role, eq(schema.role.id, schema.membershipRole.roleId))
			.leftJoin(schema.instrument, eq(schema.instrument.id, schema.membershipRole.instrumentId))
			.where(
				inArray(
					schema.membershipRole.membershipId,
					memberships.map((membership) => membership.id),
				),
			)
			.orderBy(asc(schema.role.name), asc(schema.instrument.name));

		const rolesByMembership = Map.groupBy(membershipRoles, (membershipRole) => membershipRole.membershipId);
		return {
			memberships: memberships.map((membership) => ({
				...membership,
				roles: rolesByMembership.get(membership.id) ?? [],
			})),
		};
	};
