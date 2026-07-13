import { getTableColumns, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { ArtworkMetadata } from '../artwork/storage';
import * as schema from '../db/schema';
import type { AdminListQuery, AdminListResult, AdminRepository, AdminResource, LookupOption, LookupResource } from './types';
import { createArticleMentionRepository } from './repository/articles/mentions';
import { createRelatedLoaders } from './repository/related';
import { resultRows, searchClause, selectionClause, tableId } from './repository/sql';
import type { AdminDb, RelatedLoader } from './repository/types';

export { createRelatedLoaders } from './repository/related';

interface ResourceReadDefinition {
	from: SQLWrapper;
	select: Record<string, SQLWrapper>;
	searchColumns: SQLWrapper[];
	sortColumns: Record<string, SQLWrapper>;
	defaultSort: string;
}

interface LookupDefinition {
	table: PgTable;
	from: SQL;
	id: SQL;
	label: SQL;
	description?: SQL;
	searchColumns: SQL[];
}

const raw = (value: string) => sql.raw(value);
const recordingLabel = (recordingAlias: string, compositionAlias: string) =>
	`coalesce(nullif(${recordingAlias}.version_name, ''), ${compositionAlias}.title || coalesce(' (' || ${recordingAlias}.type || ')', ''))`;
const joinedResource = (from: string, select: Record<string, string>, searchColumns: string[], sortColumns: Record<string, string>, defaultSort: string): ResourceReadDefinition => ({
	from: raw(from),
	select: Object.fromEntries(Object.entries(select).map(([key, value]) => [key, raw(value)])),
	searchColumns: searchColumns.map(raw),
	sortColumns: Object.fromEntries(Object.entries({ id: `${from.split(' ')[1]}.id`, ...sortColumns }).map(([key, value]) => [key, raw(value)])),
	defaultSort,
});

type GenericAdminResource = Exclude<AdminResource, 'article-mentions'>;
type SimpleAdminResource = 'people' | 'projects' | 'venues' | 'roles' | 'instruments' | 'labels' | 'distributors' | 'publications';
type JoinedAdminResource = Exclude<GenericAdminResource, SimpleAdminResource>;

export const resourceTables: Record<GenericAdminResource, PgTable> = {
	people: schema.person,
	projects: schema.project,
	works: schema.work,
	'work-projects': schema.workProject,
	events: schema.event,
	compositions: schema.composition,
	'composition-credits': schema.compositionCredit,
	articles: schema.article,
	contributions: schema.contribution,
	memberships: schema.membership,
	'membership-roles': schema.membershipRole,
	releases: schema.release,
	'label-relations': schema.labelRelation,
	recordings: schema.recording,
	tracks: schema.track,
	'event-performances': schema.eventPerformance,
	'publication-issues': schema.publicationIssue,
	venues: schema.venue,
	roles: schema.role,
	instruments: schema.instrument,
	labels: schema.label,
	distributors: schema.distributor,
	publications: schema.publication,
};

const simpleResource = (table: PgTable, searchColumns: SQLWrapper[], sortColumns: Record<string, SQLWrapper>, defaultSort: string): ResourceReadDefinition => ({
	from: table,
	select: getTableColumns(table),
	searchColumns,
	sortColumns: { id: tableId(table), ...sortColumns },
	defaultSort,
});

export const simpleResourceDefinitions: Record<SimpleAdminResource, ResourceReadDefinition> = {
	people: simpleResource(
		schema.person,
		[schema.person.name, schema.person.description],
		{
			name: schema.person.name,
			birthDate: schema.person.birthDate,
			activeFrom: schema.person.activeFrom,
		},
		'name',
	),
	projects: simpleResource(
		schema.project,
		[schema.project.name, schema.project.type, schema.project.description],
		{
			name: schema.project.name,
			type: schema.project.type,
			startDate: schema.project.startDate,
		},
		'name',
	),
	venues: simpleResource(schema.venue, [schema.venue.name, schema.venue.location, schema.venue.description], { name: schema.venue.name, location: schema.venue.location }, 'name'),
	roles: simpleResource(schema.role, [schema.role.name, schema.role.category, schema.role.description], { name: schema.role.name, category: schema.role.category }, 'name'),
	instruments: simpleResource(schema.instrument, [schema.instrument.name, schema.instrument.description], { name: schema.instrument.name }, 'name'),
	labels: simpleResource(schema.label, [schema.label.name, schema.label.description], { name: schema.label.name }, 'name'),
	distributors: simpleResource(schema.distributor, [schema.distributor.name, schema.distributor.description], { name: schema.distributor.name }, 'name'),
	publications: simpleResource(
		schema.publication,
		[schema.publication.name, schema.publication.type, schema.publication.publisher, schema.publication.description],
		{
			name: schema.publication.name,
			type: schema.publication.type,
			publisher: schema.publication.publisher,
		},
		'name',
	),
};

export const joinedResourceDefinitions: Record<JoinedAdminResource, ResourceReadDefinition> = {
	works: joinedResource(
		'work w join project p on p.id = w.project_id',
		{
			id: 'w.id',
			projectId: 'w.project_id',
			projectName: 'p.name',
			title: 'w.title',
			description: 'w.description',
			createdDate: 'w.created_date',
			releasedDate: 'w.released_date',
			type: 'w.type',
			releaseCount: '(select count(*)::int from release r where r.work_id = w.id)',
		},
		['w.title', 'w.description', 'p.name'],
		{ id: 'w.id', title: 'w.title', projectName: 'p.name', releasedDate: 'w.released_date' },
		'title',
	),
	'work-projects': joinedResource(
		'work_project wp join project p on p.id = wp.project_id',
		{
			id: 'wp.id',
			workId: 'wp.work_id',
			projectId: 'wp.project_id',
			projectName: 'p.name',
			relationType: 'wp.relation_type',
		},
		['p.name', 'wp.relation_type'],
		{ id: 'wp.id', projectName: 'p.name', relationType: 'wp.relation_type' },
		'projectName',
	),
	events: joinedResource(
		'event e join project p on p.id = e.project_id join venue v on v.id = e.venue_id',
		{
			id: 'e.id',
			projectId: 'e.project_id',
			projectName: 'p.name',
			venueId: 'e.venue_id',
			venueName: 'v.name',
			venueLocation: 'v.location',
			type: 'e.type',
			eventName: 'e.event_name',
			eventDate: 'e.event_date',
			startTime: 'e.start_time',
			endTime: 'e.end_time',
			doorsOpenTime: 'e.doors_open_time',
			ticketPrice: 'e.ticket_price',
			description: 'e.description',
			notes: 'e.notes',
		},
		['e.event_name', 'e.type', 'e.description', 'p.name', 'v.name', 'v.location'],
		{
			id: 'e.id',
			eventDate: 'e.event_date',
			eventName: 'e.event_name',
			projectName: 'p.name',
			venueName: 'v.name',
		},
		'eventDate',
	),
	compositions: joinedResource(
		'composition c',
		{
			id: 'c.id',
			title: 'c.title',
			description: 'c.description',
			recordingCount: '(select count(*)::int from recording r where r.composition_id = c.id)',
		},
		['c.title', 'c.description'],
		{ title: 'c.title' },
		'title',
	),
	'composition-credits': joinedResource(
		'composition_credit cc join person p on p.id = cc.person_id join composition c on c.id = cc.composition_id',
		{
			id: 'cc.id',
			compositionId: 'cc.composition_id',
			compositionTitle: 'c.title',
			personId: 'cc.person_id',
			personName: 'p.name',
			creditType: 'cc.credit_type',
			orderIndex: 'cc.order_index',
		},
		['c.title', 'p.name', 'cc.credit_type'],
		{ compositionTitle: 'c.title', personName: 'p.name', creditType: 'cc.credit_type', orderIndex: 'cc.order_index' },
		'compositionTitle',
	),
	articles: joinedResource(
		'article a left join publication_issue pi on pi.id = a.publication_issue_id left join publication p on p.id = pi.publication_id',
		{
			id: 'a.id',
			publicationIssueId: 'a.publication_issue_id',
			publicationId: 'p.id',
			publicationName: 'p.name',
			issueNumber: 'pi.issue_number',
			title: 'a.title',
			type: 'a.type',
			publishedDate: 'a.published_date',
			summary: 'a.summary',
			content: 'a.content',
			url: 'a.url',
			createdAt: 'a.created_at',
			updatedAt: 'a.updated_at',
		},
		['a.title', 'a.type', 'a.summary', 'a.content', 'p.name', 'pi.issue_number'],
		{ title: 'a.title', publicationName: 'p.name', publishedDate: 'a.published_date' },
		'publishedDate',
	),
	contributions: joinedResource(
		'contribution c join person p on p.id = c.person_id join role ro on ro.id = c.role_id left join instrument i on i.id = c.instrument_id left join recording rec on rec.id = c.recording_id left join composition co on co.id = rec.composition_id left join release rel on rel.id = c.release_id left join work w on w.id = rel.work_id left join event e on e.id = c.event_id',
		{
			id: 'c.id',
			personId: 'c.person_id',
			personName: 'p.name',
			roleId: 'c.role_id',
			roleName: 'ro.name',
			instrumentId: 'c.instrument_id',
			instrumentName: 'i.name',
			recordingId: 'c.recording_id',
			releaseId: 'c.release_id',
			eventId: 'c.event_id',
			targetType: "case when c.recording_id is not null then 'recording' when c.release_id is not null then 'release' else 'event' end",
			targetName: "coalesce(co.title, w.title || ' (' || rel.format || ')', e.event_name, e.event_date::text)",
			notes: 'c.notes',
		},
		['p.name', 'ro.name', 'i.name', 'co.title', 'w.title', 'e.event_name', 'c.notes'],
		{ personName: 'p.name', roleName: 'ro.name', targetName: 'targetName' },
		'personName',
	),
	memberships: joinedResource(
		'membership m join person pe on pe.id = m.person_id join project pr on pr.id = m.project_id',
		{
			id: 'm.id',
			personId: 'm.person_id',
			personName: 'pe.name',
			projectId: 'm.project_id',
			projectName: 'pr.name',
			fromDate: 'm.from_date',
			toDate: 'm.to_date',
			fromDatePrecision: 'm.from_date_precision',
			toDatePrecision: 'm.to_date_precision',
			support: 'm.support',
			note: 'm.note',
		},
		['pe.name', 'pr.name', 'm.note'],
		{ id: 'm.id', personName: 'pe.name', projectName: 'pr.name', fromDate: 'm.from_date' },
		'fromDate',
	),
	'membership-roles': joinedResource(
		'membership_role mr join role r on r.id = mr.role_id left join instrument i on i.id = mr.instrument_id',
		{
			id: 'mr.id',
			membershipId: 'mr.membership_id',
			roleId: 'mr.role_id',
			roleName: 'r.name',
			instrumentId: 'mr.instrument_id',
			instrumentName: 'i.name',
		},
		['r.name', 'i.name'],
		{ id: 'mr.id', roleName: 'r.name', instrumentName: 'i.name' },
		'roleName',
	),
	releases: joinedResource(
		'release r join work w on w.id = r.work_id join project p on p.id = w.project_id left join distributor d on d.id = r.distributor_id',
		{
			id: 'r.id',
			workId: 'r.work_id',
			workTitle: 'w.title',
			projectName: 'p.name',
			format: 'r.format',
			catalogNumber: 'r.catalog_number',
			releaseDate: 'r.release_date',
			editionType: 'r.edition_type',
			reissueOfReleaseId: 'r.reissue_of_release_id',
			releaseDatePrecision: 'r.release_date_precision',
			recordedFrom: 'r.recorded_from',
			recordedTo: 'r.recorded_to',
			description: 'r.description',
			notes: 'r.notes',
			distributorId: 'r.distributor_id',
			distributorName: 'd.name',
			artworkUrl: 'r.artwork_url',
			artworkWidth: 'r.artwork_width',
			artworkHeight: 'r.artwork_height',
		},
		['w.title', 'p.name', 'r.format', 'r.catalog_number', 'd.name'],
		{ id: 'r.id', workTitle: 'w.title', releaseDate: 'r.release_date', format: 'r.format' },
		'releaseDate',
	),
	'label-relations': joinedResource(
		'label_relation lr join label l on l.id = lr.label_id join release r on r.id = lr.release_id join work w on w.id = r.work_id',
		{
			id: 'lr.id',
			releaseId: 'lr.release_id',
			releaseName: "w.title || ' (' || r.format || ')'",
			labelId: 'lr.label_id',
			labelName: 'l.name',
		},
		['w.title', 'r.format', 'l.name'],
		{ id: 'lr.id', releaseName: 'w.title', labelName: 'l.name' },
		'labelName',
	),
	recordings: joinedResource(
		'recording r join composition c on c.id = r.composition_id',
		{
			id: 'r.id',
			compositionId: 'r.composition_id',
			compositionTitle: 'c.title',
			versionName: 'r.version_name',
			versionDescription: 'r.version_description',
			recordingYear: 'r.recording_year',
			type: 'r.type',
			recordedDate: 'r.recorded_date',
			recordedFrom: 'r.recorded_from',
			recordedTo: 'r.recorded_to',
			releaseDate: 'r.release_date',
			notes: 'r.notes',
		},
		['c.title', 'r.version_name', 'r.version_description', 'r.type', 'r.notes'],
		{ id: 'r.id', compositionTitle: 'c.title', recordingYear: 'r.recording_year' },
		'compositionTitle',
	),
	tracks: joinedResource(
		'track t join release rel on rel.id = t.release_id join work w on w.id = rel.work_id join recording rec on rec.id = t.recording_id join composition c on c.id = rec.composition_id',
		{
			id: 't.id',
			releaseId: 't.release_id',
			releaseName: "w.title || ' (' || rel.format || ')'",
			recordingId: 't.recording_id',
			recordingName: recordingLabel('rec', 'c'),
			compositionTitle: 'c.title',
			trackNumber: 't.track_number',
			recordedDate: 't.recorded_date',
			notes: 't.notes',
		},
		['w.title', 'rel.format', 'c.title', 't.notes'],
		{
			id: 't.id',
			releaseName: 'w.title',
			trackNumber: 't.track_number',
			compositionTitle: 'c.title',
		},
		'releaseName',
	),
	'event-performances': joinedResource(
		'event_performance ep join event e on e.id = ep.event_id join composition c on c.id = ep.composition_id',
		{
			id: 'ep.id',
			eventId: 'ep.event_id',
			eventName: 'coalesce(e.event_name, e.event_date::text)',
			compositionId: 'ep.composition_id',
			compositionTitle: 'c.title',
			orderIndex: 'ep.order_index',
			encore: 'ep.encore',
			variationNote: 'ep.variation_note',
			notes: 'ep.notes',
		},
		['e.event_name', 'c.title', 'ep.variation_note', 'ep.notes'],
		{
			id: 'ep.id',
			eventName: 'e.event_date',
			orderIndex: 'ep.order_index',
			compositionTitle: 'c.title',
		},
		'eventName',
	),
	'publication-issues': joinedResource(
		'publication_issue pi join publication p on p.id = pi.publication_id',
		{
			id: 'pi.id',
			publicationId: 'pi.publication_id',
			publicationName: 'p.name',
			issueNumber: 'pi.issue_number',
			volume: 'pi.volume',
			publishedDate: 'pi.published_date',
			description: 'pi.description',
		},
		['p.name', 'pi.issue_number', 'pi.volume', 'pi.description'],
		{ id: 'pi.id', publicationName: 'p.name', publishedDate: 'pi.published_date' },
		'publishedDate',
	),
};

const lookup = (table: PgTable, from: string, id: string, label: string, searchColumns: string[], description?: string): LookupDefinition => ({
	table,
	from: raw(from),
	id: raw(id),
	label: raw(label),
	...(description ? { description: raw(description) } : {}),
	searchColumns: searchColumns.map(raw),
});

export const lookupDefinitions: Record<LookupResource, LookupDefinition> = {
	project: lookup(schema.project, 'project p', 'p.id', 'p.name', ['p.name', 'p.type'], 'p.type'),
	person: lookup(schema.person, 'person p', 'p.id', 'p.name', ['p.name'], 'p.description'),
	composition: lookup(schema.composition, 'composition c', 'c.id', 'c.title', ['c.title'], 'c.description'),
	work: lookup(schema.work, 'work w join project p on p.id = w.project_id', 'w.id', "w.title || ' — ' || p.name", ['w.title', 'p.name'], 'p.name'),
	release: lookup(schema.release, 'release r join work w on w.id = r.work_id', 'r.id', "w.title || ' (' || r.format || ')'", ['w.title', 'r.format', 'r.catalog_number'], 'r.catalog_number'),
	recording: lookup(schema.recording, 'recording r join composition c on c.id = r.composition_id', 'r.id', recordingLabel('r', 'c'), ['r.version_name', 'c.title', 'r.type', 'r.notes'], 'r.notes'),
	event: lookup(
		schema.event,
		'event e join project p on p.id = e.project_id',
		'e.id',
		"coalesce(e.event_name, e.event_date::text) || ' — ' || p.name",
		['e.event_name', 'e.event_date::text', 'p.name'],
		'e.event_date::text',
	),
	'publication-issue': lookup(
		schema.publicationIssue,
		'publication_issue pi join publication p on p.id = pi.publication_id',
		'pi.id',
		"p.name || coalesce(' ' || pi.issue_number, '') || coalesce(' ' || pi.published_date::text, '')",
		['p.name', 'pi.issue_number', 'pi.volume', 'pi.published_date::text'],
		'pi.description',
	),
	venue: lookup(schema.venue, 'venue v', 'v.id', "v.name || coalesce(' — ' || v.location, '')", ['v.name', 'v.location'], 'v.location'),
	role: lookup(schema.role, 'role r', 'r.id', 'r.name', ['r.name', 'r.category'], 'r.category'),
	instrument: lookup(schema.instrument, 'instrument i', 'i.id', 'i.name', ['i.name'], 'i.description'),
	label: lookup(schema.label, 'label l', 'l.id', 'l.name', ['l.name'], 'l.description'),
	distributor: lookup(schema.distributor, 'distributor d', 'd.id', 'd.name', ['d.name'], 'd.description'),
	publication: lookup(schema.publication, 'publication p', 'p.id', 'p.name', ['p.name', 'p.publisher'], 'p.publisher'),
};

function readDefinition(resourceName: GenericAdminResource): ResourceReadDefinition {
	if (resourceName in simpleResourceDefinitions) {
		return simpleResourceDefinitions[resourceName as SimpleAdminResource];
	}
	return joinedResourceDefinitions[resourceName as JoinedAdminResource];
}

const createList =
	(database: AdminDb) =>
	async (resourceName: GenericAdminResource, query: AdminListQuery): Promise<AdminListResult> => {
		const definition = readDefinition(resourceName);
		const where = searchClause(definition.searchColumns, query.search);
		const selectedSort = definition.sortColumns[query.sort ?? definition.defaultSort] ?? definition.sortColumns[definition.defaultSort];
		const direction = query.direction === 'desc' ? sql.raw('desc') : sql.raw('asc');
		const offset = (query.page - 1) * query.pageSize;
		const selection = selectionClause(definition.select);

		const [itemsResult, countResult] = await Promise.all([
			database.execute(sql`
	        select ${selection}
	        from ${definition.from}
	        ${where}
        order by ${selectedSort} ${direction} nulls last
	        limit ${query.pageSize}
	        offset ${offset}
	      `),
			database.execute(sql`
	        select count(*)::int as total
	        from ${definition.from}
	        ${where}
      `),
		]);

		return {
			items: resultRows(itemsResult),
			total: Number(resultRows(countResult)[0]?.['total'] ?? 0),
		};
	};

const createDetail =
	(database: AdminDb) =>
	(relatedLoaders: Partial<Record<AdminResource, RelatedLoader>>) =>
	async (resourceName: GenericAdminResource, id: string): Promise<Record<string, unknown> | null> => {
		const definition = readDefinition(resourceName);
		const selection = selectionClause(definition.select);
		const result = await database.execute(sql`
	      select ${selection}
	      from ${definition.from}
	      where ${definition.select['id']} = ${id}
      limit 1
    `);
		const record = resultRows(result)[0];
		if (!record) return null;

		const related = await relatedLoaders[resourceName]?.(id);
		if (!related) return record;
		return Object.keys(related).length > 0 ? { ...record, related } : record;
	};

const createRecord = (database: AdminDb) => async (resourceName: GenericAdminResource, value: Record<string, unknown>) => {
	const table = resourceTables[resourceName];
	const rows = await database.insert(table).values(value).returning();
	return rows[0] as Record<string, unknown>;
};

const updateRecord = (database: AdminDb) => async (resourceName: GenericAdminResource, id: string, value: Record<string, unknown>) => {
	const table = resourceTables[resourceName];
	const rows = await database
		.update(table)
		.set(value)
		.where(sql`${tableId(table)} = ${id}`)
		.returning();
	return (rows[0] as Record<string, unknown> | undefined) ?? null;
};

const updateReleaseArtwork = (database: AdminDb) => async (id: string, value: ArtworkMetadata) => {
	const rows = await database
		.update(schema.release)
		.set(value)
		.where(sql`${schema.release.id} = ${id}`)
		.returning();
	return (rows[0] as Record<string, unknown> | undefined) ?? null;
};

const deleteRecord = (database: AdminDb) => async (resourceName: GenericAdminResource, id: string) => {
	const table = resourceTables[resourceName];
	const rows = await database
		.delete(table)
		.where(sql`${tableId(table)} = ${id}`)
		.returning();
	return rows.length > 0;
};

const createLookup =
	(database: AdminDb) =>
	async (resourceName: LookupResource, search: string): Promise<LookupOption[]> => {
		const definition = lookupDefinitions[resourceName];
		const where = searchClause(definition.searchColumns, search);
		const description = definition.description ?? sql`null`;
		const result = await database.execute(sql`
	      select
	        ${definition.id} as "id",
        ${definition.label} as "label",
        ${description} as "description"
      from ${definition.from}
      ${where}
      order by ${definition.label} asc
	      limit 50
	    `);
		return resultRows(result) as unknown as LookupOption[];
	};

export function createAdminRepository(database: AdminDb): AdminRepository {
	const relatedLoaders = createRelatedLoaders(database);
	const list = createList(database);
	const detail = createDetail(database)(relatedLoaders);
	const create = createRecord(database);
	const update = updateRecord(database);
	const updateArtwork = updateReleaseArtwork(database);
	const remove = deleteRecord(database);
	const lookup = createLookup(database);
	const articleMentions = createArticleMentionRepository(database);

	return {
		list: (resource, query) => (resource === 'article-mentions' ? articleMentions.list(query) : list(resource, query)),
		detail: (resource, id) => (resource === 'article-mentions' ? articleMentions.detail(id) : detail(resource, id)),
		create: (resource, value) => (resource === 'article-mentions' ? articleMentions.create(value) : create(resource, value)),
		update: (resource, id, value) => (resource === 'article-mentions' ? articleMentions.update(id, value) : update(resource, id, value)),
		updateArtwork,
		delete: (resource, id) => (resource === 'tracks' ? remove(resource, id) : Promise.resolve(false)),
		lookup,
	};
}
