import {
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db as defaultDb } from "../db";
import * as schema from "../db/schema";
import type {
  AdminListQuery,
  AdminListResult,
  AdminRepository,
  AdminResource,
  LookupOption,
  LookupResource,
} from "./types";

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
const joinedResource = (
  from: string,
  select: Record<string, string>,
  searchColumns: string[],
  sortColumns: Record<string, string>,
  defaultSort: string,
): ResourceReadDefinition => ({
  from: raw(from),
  select: Object.fromEntries(Object.entries(select).map(([key, value]) => [key, raw(value)])),
  searchColumns: searchColumns.map(raw),
  sortColumns: Object.fromEntries(
    Object.entries({ id: `${from.split(" ")[1]}.id`, ...sortColumns }).map(([key, value]) => [
      key,
      raw(value),
    ]),
  ),
  defaultSort,
});

type GenericAdminResource = Exclude<AdminResource, "article-mentions">;
type SimpleAdminResource =
  | "people"
  | "projects"
  | "venues"
  | "roles"
  | "instruments"
  | "labels"
  | "distributors"
  | "publications";
type JoinedAdminResource = Exclude<GenericAdminResource, SimpleAdminResource>;

export const resourceTables: Record<GenericAdminResource, PgTable> = {
  people: schema.person,
  projects: schema.project,
  works: schema.work,
  events: schema.event,
  compositions: schema.composition,
  articles: schema.article,
  contributions: schema.contribution,
  memberships: schema.membership,
  "membership-roles": schema.membershipRole,
  releases: schema.release,
  "label-relations": schema.labelRelation,
  recordings: schema.recording,
  tracks: schema.track,
  "event-performances": schema.eventPerformance,
  "publication-issues": schema.publicationIssue,
  venues: schema.venue,
  roles: schema.role,
  instruments: schema.instrument,
  labels: schema.label,
  distributors: schema.distributor,
  publications: schema.publication,
};

function tableId(table: PgTable): SQLWrapper {
  const id = getTableColumns(table)["id"];
  if (!id) throw new Error("Admin resource table has no id column");
  return id;
}

const simpleResource = (
  table: PgTable,
  searchColumns: SQLWrapper[],
  sortColumns: Record<string, SQLWrapper>,
  defaultSort: string,
): ResourceReadDefinition => ({
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
    "name",
  ),
  projects: simpleResource(
    schema.project,
    [schema.project.name, schema.project.type, schema.project.description],
    {
      name: schema.project.name,
      type: schema.project.type,
      startDate: schema.project.startDate,
    },
    "name",
  ),
  venues: simpleResource(
    schema.venue,
    [schema.venue.name, schema.venue.location, schema.venue.description],
    { name: schema.venue.name, location: schema.venue.location },
    "name",
  ),
  roles: simpleResource(
    schema.role,
    [schema.role.name, schema.role.category, schema.role.description],
    { name: schema.role.name, category: schema.role.category },
    "name",
  ),
  instruments: simpleResource(
    schema.instrument,
    [schema.instrument.name, schema.instrument.description],
    { name: schema.instrument.name },
    "name",
  ),
  labels: simpleResource(
    schema.label,
    [schema.label.name, schema.label.description],
    { name: schema.label.name },
    "name",
  ),
  distributors: simpleResource(
    schema.distributor,
    [schema.distributor.name, schema.distributor.description],
    { name: schema.distributor.name },
    "name",
  ),
  publications: simpleResource(
    schema.publication,
    [
      schema.publication.name,
      schema.publication.type,
      schema.publication.publisher,
      schema.publication.description,
    ],
    {
      name: schema.publication.name,
      type: schema.publication.type,
      publisher: schema.publication.publisher,
    },
    "name",
  ),
};

export const joinedResourceDefinitions: Record<JoinedAdminResource, ResourceReadDefinition> = {
  works: joinedResource(
    "work w join project p on p.id = w.project_id",
    {
      id: "w.id",
      projectId: "w.project_id",
      projectName: "p.name",
      title: "w.title",
      description: "w.description",
      createdDate: "w.created_date",
      releasedDate: "w.released_date",
      releaseCount: "(select count(*)::int from release r where r.work_id = w.id)",
    },
    ["w.title", "w.description", "p.name"],
    { id: "w.id", title: "w.title", projectName: "p.name", releasedDate: "w.released_date" },
    "title",
  ),
  events: joinedResource(
    "event e join project p on p.id = e.project_id join venue v on v.id = e.venue_id",
    {
      id: "e.id",
      projectId: "e.project_id",
      projectName: "p.name",
      venueId: "e.venue_id",
      venueName: "v.name",
      venueLocation: "v.location",
      type: "e.type",
      eventName: "e.event_name",
      eventDate: "e.event_date",
      startTime: "e.start_time",
      endTime: "e.end_time",
      doorsOpenTime: "e.doors_open_time",
      ticketPrice: "e.ticket_price",
      description: "e.description",
      notes: "e.notes",
    },
    ["e.event_name", "e.type", "e.description", "p.name", "v.name", "v.location"],
    {
      id: "e.id",
      eventDate: "e.event_date",
      eventName: "e.event_name",
      projectName: "p.name",
      venueName: "v.name",
    },
    "eventDate",
  ),
  compositions: joinedResource(
    "composition c",
    {
      id: "c.id",
      title: "c.title",
      description: "c.description",
      recordingCount: "(select count(*)::int from recording r where r.composition_id = c.id)",
    },
    ["c.title", "c.description"],
    { title: "c.title" },
    "title",
  ),
  articles: joinedResource(
    "article a left join publication_issue pi on pi.id = a.publication_issue_id left join publication p on p.id = pi.publication_id",
    {
      id: "a.id",
      publicationIssueId: "a.publication_issue_id",
      publicationId: "p.id",
      publicationName: "p.name",
      issueNumber: "pi.issue_number",
      title: "a.title",
      type: "a.type",
      publishedDate: "a.published_date",
      summary: "a.summary",
      content: "a.content",
      url: "a.url",
      createdAt: "a.created_at",
      updatedAt: "a.updated_at",
    },
    ["a.title", "a.type", "a.summary", "a.content", "p.name", "pi.issue_number"],
    { title: "a.title", publicationName: "p.name", publishedDate: "a.published_date" },
    "publishedDate",
  ),
  contributions: joinedResource(
    "contribution c join person p on p.id = c.person_id join role ro on ro.id = c.role_id left join instrument i on i.id = c.instrument_id left join recording rec on rec.id = c.recording_id left join composition co on co.id = rec.composition_id left join release rel on rel.id = c.release_id left join work w on w.id = rel.work_id left join event e on e.id = c.event_id",
    {
      id: "c.id",
      personId: "c.person_id",
      personName: "p.name",
      roleId: "c.role_id",
      roleName: "ro.name",
      instrumentId: "c.instrument_id",
      instrumentName: "i.name",
      recordingId: "c.recording_id",
      releaseId: "c.release_id",
      eventId: "c.event_id",
      targetType: "case when c.recording_id is not null then 'recording' when c.release_id is not null then 'release' else 'event' end",
      targetName: "coalesce(co.title, w.title || ' (' || rel.format || ')', e.event_name, e.event_date::text)",
      notes: "c.notes",
    },
    ["p.name", "ro.name", "i.name", "co.title", "w.title", "e.event_name", "c.notes"],
    { personName: "p.name", roleName: "ro.name", targetName: "targetName" },
    "personName",
  ),
  memberships: joinedResource(
    "membership m join person pe on pe.id = m.person_id join project pr on pr.id = m.project_id",
    {
      id: "m.id",
      personId: "m.person_id",
      personName: "pe.name",
      projectId: "m.project_id",
      projectName: "pr.name",
      fromDate: "m.from_date",
      toDate: "m.to_date",
      fromDatePrecision: "m.from_date_precision",
      toDatePrecision: "m.to_date_precision",
      support: "m.support",
      note: "m.note",
    },
    ["pe.name", "pr.name", "m.note"],
    { id: "m.id", personName: "pe.name", projectName: "pr.name", fromDate: "m.from_date" },
    "fromDate",
  ),
  "membership-roles": joinedResource(
    "membership_role mr join role r on r.id = mr.role_id left join instrument i on i.id = mr.instrument_id",
    {
      id: "mr.id",
      membershipId: "mr.membership_id",
      roleId: "mr.role_id",
      roleName: "r.name",
      instrumentId: "mr.instrument_id",
      instrumentName: "i.name",
    },
    ["r.name", "i.name"],
    { id: "mr.id", roleName: "r.name", instrumentName: "i.name" },
    "roleName",
  ),
  releases: joinedResource(
    "release r join work w on w.id = r.work_id join project p on p.id = w.project_id left join distributor d on d.id = r.distributor_id",
    {
      id: "r.id",
      workId: "r.work_id",
      workTitle: "w.title",
      projectName: "p.name",
      format: "r.format",
      catalogNumber: "r.catalog_number",
      releaseDate: "r.release_date",
      releaseDatePrecision: "r.release_date_precision",
      recordedFrom: "r.recorded_from",
      recordedTo: "r.recorded_to",
      description: "r.description",
      notes: "r.notes",
      distributorId: "r.distributor_id",
      distributorName: "d.name",
    },
    ["w.title", "p.name", "r.format", "r.catalog_number", "d.name"],
    { id: "r.id", workTitle: "w.title", releaseDate: "r.release_date", format: "r.format" },
    "releaseDate",
  ),
  "label-relations": joinedResource(
    "label_relation lr join label l on l.id = lr.label_id join release r on r.id = lr.release_id join work w on w.id = r.work_id",
    {
      id: "lr.id",
      releaseId: "lr.release_id",
      releaseName: "w.title || ' (' || r.format || ')'",
      labelId: "lr.label_id",
      labelName: "l.name",
    },
    ["w.title", "r.format", "l.name"],
    { id: "lr.id", releaseName: "w.title", labelName: "l.name" },
    "labelName",
  ),
  recordings: joinedResource(
    "recording r join composition c on c.id = r.composition_id",
    {
      id: "r.id",
      compositionId: "r.composition_id",
      compositionTitle: "c.title",
      recordingYear: "r.recording_year",
      type: "r.type",
      recordedDate: "r.recorded_date",
      recordedFrom: "r.recorded_from",
      recordedTo: "r.recorded_to",
      releaseDate: "r.release_date",
      notes: "r.notes",
    },
    ["c.title", "r.type", "r.notes"],
    { id: "r.id", compositionTitle: "c.title", recordingYear: "r.recording_year" },
    "compositionTitle",
  ),
  tracks: joinedResource(
    "track t join release rel on rel.id = t.release_id join work w on w.id = rel.work_id join recording rec on rec.id = t.recording_id join composition c on c.id = rec.composition_id",
    {
      id: "t.id",
      releaseId: "t.release_id",
      releaseName: "w.title || ' (' || rel.format || ')'",
      recordingId: "t.recording_id",
      compositionTitle: "c.title",
      trackNumber: "t.track_number",
      recordedDate: "t.recorded_date",
      notes: "t.notes",
    },
    ["w.title", "rel.format", "c.title", "t.notes"],
    { id: "t.id", releaseName: "w.title", trackNumber: "t.track_number", compositionTitle: "c.title" },
    "releaseName",
  ),
  "event-performances": joinedResource(
    "event_performance ep join event e on e.id = ep.event_id join composition c on c.id = ep.composition_id",
    {
      id: "ep.id",
      eventId: "ep.event_id",
      eventName: "coalesce(e.event_name, e.event_date::text)",
      compositionId: "ep.composition_id",
      compositionTitle: "c.title",
      orderIndex: "ep.order_index",
      encore: "ep.encore",
      variationNote: "ep.variation_note",
      notes: "ep.notes",
    },
    ["e.event_name", "c.title", "ep.variation_note", "ep.notes"],
    { id: "ep.id", eventName: "e.event_date", orderIndex: "ep.order_index", compositionTitle: "c.title" },
    "eventName",
  ),
  "publication-issues": joinedResource(
    "publication_issue pi join publication p on p.id = pi.publication_id",
    {
      id: "pi.id",
      publicationId: "pi.publication_id",
      publicationName: "p.name",
      issueNumber: "pi.issue_number",
      volume: "pi.volume",
      publishedDate: "pi.published_date",
      description: "pi.description",
    },
    ["p.name", "pi.issue_number", "pi.volume", "pi.description"],
    { id: "pi.id", publicationName: "p.name", publishedDate: "pi.published_date" },
    "publishedDate",
  ),
};

const lookup = (
  table: PgTable,
  from: string,
  id: string,
  label: string,
  searchColumns: string[],
  description?: string,
): LookupDefinition => ({
  table,
  from: raw(from),
  id: raw(id),
  label: raw(label),
  ...(description ? { description: raw(description) } : {}),
  searchColumns: searchColumns.map(raw),
});

export const lookupDefinitions: Record<LookupResource, LookupDefinition> = {
  project: lookup(schema.project, "project p", "p.id", "p.name", ["p.name", "p.type"], "p.type"),
  person: lookup(schema.person, "person p", "p.id", "p.name", ["p.name"], "p.description"),
  composition: lookup(schema.composition, "composition c", "c.id", "c.title", ["c.title"], "c.description"),
  work: lookup(schema.work, "work w join project p on p.id = w.project_id", "w.id", "w.title || ' — ' || p.name", ["w.title", "p.name"], "p.name"),
  release: lookup(schema.release, "release r join work w on w.id = r.work_id", "r.id", "w.title || ' (' || r.format || ')'", ["w.title", "r.format", "r.catalog_number"], "r.catalog_number"),
  recording: lookup(schema.recording, "recording r join composition c on c.id = r.composition_id", "r.id", "c.title || coalesce(' (' || r.type || ')', '')", ["c.title", "r.type", "r.notes"], "r.notes"),
  event: lookup(schema.event, "event e join project p on p.id = e.project_id", "e.id", "coalesce(e.event_name, e.event_date::text) || ' — ' || p.name", ["e.event_name", "e.event_date::text", "p.name"], "e.event_date::text"),
  "publication-issue": lookup(schema.publicationIssue, "publication_issue pi join publication p on p.id = pi.publication_id", "pi.id", "p.name || coalesce(' ' || pi.issue_number, '') || coalesce(' ' || pi.published_date::text, '')", ["p.name", "pi.issue_number", "pi.volume", "pi.published_date::text"], "pi.description"),
  venue: lookup(schema.venue, "venue v", "v.id", "v.name || coalesce(' — ' || v.location, '')", ["v.name", "v.location"], "v.location"),
  role: lookup(schema.role, "role r", "r.id", "r.name", ["r.name", "r.category"], "r.category"),
  instrument: lookup(schema.instrument, "instrument i", "i.id", "i.name", ["i.name"], "i.description"),
  label: lookup(schema.label, "label l", "l.id", "l.name", ["l.name"], "l.description"),
  distributor: lookup(schema.distributor, "distributor d", "d.id", "d.name", ["d.name"], "d.description"),
  publication: lookup(schema.publication, "publication p", "p.id", "p.name", ["p.name", "p.publisher"], "p.publisher"),
};

function readDefinition(resourceName: GenericAdminResource): ResourceReadDefinition {
  if (resourceName in simpleResourceDefinitions) {
    return simpleResourceDefinitions[resourceName as SimpleAdminResource];
  }
  return joinedResourceDefinitions[resourceName as JoinedAdminResource];
}

type AdminDb = typeof defaultDb;
type RelatedLoader = (
  database: AdminDb,
  id: string,
) => Promise<Record<string, unknown>>;

export const relatedLoaders = {
  people: loadPeopleRelated,
  projects: loadProjectRelated,
  works: loadWorkRelated,
  compositions: loadCompositionRelated,
  events: loadEventRelated,
  articles: loadArticleRelated,
} satisfies Partial<Record<AdminResource, RelatedLoader>>;

export class DrizzleAdminRepository implements AdminRepository {
  constructor(private readonly database: AdminDb = defaultDb) {}

  async list(resourceName: AdminResource, query: AdminListQuery): Promise<AdminListResult> {
    if (resourceName === "article-mentions") {
      return await this.listArticleMentions(query);
    }

    const definition = readDefinition(resourceName);
    const where = searchClause(definition.searchColumns, query.search);
    const selectedSort =
      definition.sortColumns[query.sort ?? definition.defaultSort] ??
      definition.sortColumns[definition.defaultSort];
    const direction = query.direction === "desc" ? sql.raw("desc") : sql.raw("asc");
    const offset = (query.page - 1) * query.pageSize;
    const selection = selectionClause(definition.select);

    const [itemsResult, countResult] = await Promise.all([
      this.database.execute(sql`
        select ${selection}
        from ${definition.from}
        ${where}
        order by ${selectedSort} ${direction} nulls last
        limit ${query.pageSize}
        offset ${offset}
      `),
      this.database.execute(sql`
        select count(*)::int as total
        from ${definition.from}
        ${where}
      `),
    ]);

    return {
      items: resultRows(itemsResult),
      total: Number(resultRows(countResult)[0]?.["total"] ?? 0),
    };
  }

  async detail(resourceName: AdminResource, id: string): Promise<Record<string, unknown> | null> {
    if (resourceName === "article-mentions") {
      return await this.findArticleMention(id);
    }

    const definition = readDefinition(resourceName);
    const selection = selectionClause(definition.select);
    const result = await this.database.execute(sql`
      select ${selection}
      from ${definition.from}
      where ${definition.select["id"]} = ${id}
      limit 1
    `);
    const record = resultRows(result)[0];
    if (!record) return null;

    const related = await this.related(resourceName, id);
    return Object.keys(related).length > 0 ? { ...record, related } : record;
  }

  async create(resourceName: AdminResource, value: Record<string, unknown>) {
    if (resourceName === "article-mentions") {
      return await this.createArticleMention(value);
    }
    const table = resourceTables[resourceName];
    const rows = await this.database
      .insert(table)
      .values(value)
      .returning();
    return rows[0] as Record<string, unknown>;
  }

  async update(resourceName: AdminResource, id: string, value: Record<string, unknown>) {
    if (resourceName === "article-mentions") {
      return await this.updateArticleMention(id, value);
    }
    const table = resourceTables[resourceName];
    const rows = await this.database
      .update(table)
      .set(value)
      .where(sql`${tableId(table)} = ${id}`)
      .returning();
    return (rows[0] as Record<string, unknown> | undefined) ?? null;
  }

  async lookup(resourceName: LookupResource, search: string): Promise<LookupOption[]> {
    const definition = lookupDefinitions[resourceName];
    const where = searchClause(definition.searchColumns, search);
    const description = definition.description ?? sql`null`;
    const result = await this.database.execute(sql`
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
  }

  private async related(resourceName: AdminResource, id: string) {
    const loader = relatedLoaders[resourceName as keyof typeof relatedLoaders] as
      | RelatedLoader
      | undefined;
    return loader ? await loader(this.database, id) : {};
  }

  private async listArticleMentions(query: AdminListQuery): Promise<AdminListResult> {
    const search = `%${query.search}%`;
    const offset = (query.page - 1) * query.pageSize;
    const filter = query.search
      ? sql`where concat_ws(' ', "articleTitle", "targetName", "mentionType", notes) ilike ${search}`
      : sql.empty();
    const union = allArticleMentions();
    const [itemsResult, countResult] = await Promise.all([
      this.database.execute(sql`
        select * from (${union}) mentions
        ${filter}
        order by "mentionType", "targetName"
        limit ${query.pageSize} offset ${offset}
      `),
      this.database.execute(sql`select count(*)::int as total from (${union}) mentions ${filter}`),
    ]);
    return {
      items: resultRows(itemsResult),
      total: Number(resultRows(countResult)[0]?.["total"] ?? 0),
    };
  }

  private async findArticleMention(id: string) {
    const result = await this.database.execute(sql`
      select * from (${allArticleMentions()}) mentions where id = ${id} limit 1
    `);
    return resultRows(result)[0] ?? null;
  }

  private async createArticleMention(value: Record<string, unknown>) {
    const { targetType, targetId, ...common } = value;
    const table = mentionTable(String(targetType));
    const targetColumn = mentionTargetColumn(String(targetType));
    const rows = await this.database
      .insert(table)
      .values({ ...common, [targetColumn]: targetId })
      .returning();
    return { ...rows[0], targetType, targetId };
  }

  private async updateArticleMention(id: string, value: Record<string, unknown>) {
    const existing = await this.findArticleMention(id);
    if (!existing) return null;
    if (existing["targetType"] !== value["targetType"]) {
      const error = new Error("Changing mention target type is not supported");
      Object.assign(error, { code: "23514", constraint: "article_mention_target_type" });
      throw error;
    }
    const { targetType, targetId, ...common } = value;
    const table = mentionTable(String(targetType));
    const targetColumn = mentionTargetColumn(String(targetType));
    const rows = await this.database
      .update(table)
      .set({ ...common, [targetColumn]: targetId })
      .where(sql`${tableId(table)} = ${id}`)
      .returning();
    return rows[0] ? { ...rows[0], targetType, targetId } : null;
  }
}

async function loadPeopleRelated(database: AdminDb, personId: string) {
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

  const rolesByMembership = Map.groupBy(
    membershipRoles,
    (membershipRole) => membershipRole.membershipId,
  );
  return {
    memberships: memberships.map((membership) => ({
      ...membership,
      roles: rolesByMembership.get(membership.id) ?? [],
    })),
  };
}

async function loadProjectRelated(database: AdminDb, projectId: string) {
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
}

async function loadWorkRelated(database: AdminDb, workId: string) {
  const [releases, tracks] = await Promise.all([
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
      .innerJoin(
        schema.composition,
        eq(schema.composition.id, schema.recording.compositionId),
      )
      .where(eq(schema.release.workId, workId))
      .orderBy(
        asc(schema.release.releaseDate),
        asc(schema.release.format),
        asc(schema.track.trackNumber),
      ),
  ]);

  if (releases.length === 0) return { releases: [], tracks };

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

  const labelsByRelease = Map.groupBy(
    labelRelations,
    (labelRelation) => labelRelation.releaseId,
  );
  return {
    releases: releases.map((release) => ({
      ...release,
      labels: labelsByRelease.get(release.id) ?? [],
    })),
    tracks,
  };
}

async function loadCompositionRelated(database: AdminDb, compositionId: string) {
  const [recordings, releaseAppearances, eventAppearances] = await Promise.all([
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
      .orderBy(
        sql`coalesce(${schema.recording.recordedDate}, ${schema.recording.releaseDate}) desc nulls last`,
      ),
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
      type: "release",
      id,
      label: `${title} (${format})`,
      orderIndex,
    })),
    ...eventAppearances.map(({ id, eventName, eventDate, orderIndex }) => ({
      type: "event",
      id,
      label: eventName ?? eventDate,
      orderIndex,
    })),
  ].sort((left, right) => left.label.localeCompare(right.label, "ja"));

  return { recordings, appearances };
}

async function loadEventRelated(database: AdminDb, eventId: string) {
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
    .innerJoin(
      schema.composition,
      eq(schema.composition.id, schema.eventPerformance.compositionId),
    )
    .where(eq(schema.eventPerformance.eventId, eventId))
    .orderBy(asc(schema.eventPerformance.orderIndex));

  return { performances };
}

async function loadArticleRelated(database: AdminDb, articleId: string) {
  const [issue, workMentions, eventMentions, personMentions] = await Promise.all([
    database
      .select({
        id: schema.publicationIssue.id,
        publicationId: schema.publicationIssue.publicationId,
        publicationName: schema.publication.name,
        issueNumber: schema.publicationIssue.issueNumber,
        volume: schema.publicationIssue.volume,
        publishedDate: schema.publicationIssue.publishedDate,
        description: schema.publicationIssue.description,
      })
      .from(schema.article)
      .innerJoin(
        schema.publicationIssue,
        eq(schema.publicationIssue.id, schema.article.publicationIssueId),
      )
      .innerJoin(
        schema.publication,
        eq(schema.publication.id, schema.publicationIssue.publicationId),
      )
      .where(eq(schema.article.id, articleId)),
    database
      .select({
        id: schema.articleMentionWork.id,
        articleId: schema.articleMentionWork.articleId,
        articleTitle: schema.article.title,
        targetId: schema.work.id,
        targetName: schema.work.title,
        mentionType: schema.articleMentionWork.mentionType,
        notes: schema.articleMentionWork.notes,
      })
      .from(schema.articleMentionWork)
      .innerJoin(schema.article, eq(schema.article.id, schema.articleMentionWork.articleId))
      .innerJoin(schema.work, eq(schema.work.id, schema.articleMentionWork.workId))
      .where(eq(schema.articleMentionWork.articleId, articleId)),
    database
      .select({
        id: schema.articleMentionEvent.id,
        articleId: schema.articleMentionEvent.articleId,
        articleTitle: schema.article.title,
        targetId: schema.event.id,
        eventName: schema.event.eventName,
        eventDate: schema.event.eventDate,
        mentionType: schema.articleMentionEvent.mentionType,
        notes: schema.articleMentionEvent.notes,
      })
      .from(schema.articleMentionEvent)
      .innerJoin(schema.article, eq(schema.article.id, schema.articleMentionEvent.articleId))
      .innerJoin(schema.event, eq(schema.event.id, schema.articleMentionEvent.eventId))
      .where(eq(schema.articleMentionEvent.articleId, articleId)),
    database
      .select({
        id: schema.articleMentionPerson.id,
        articleId: schema.articleMentionPerson.articleId,
        articleTitle: schema.article.title,
        targetId: schema.person.id,
        targetName: schema.person.name,
        mentionType: schema.articleMentionPerson.mentionType,
        notes: schema.articleMentionPerson.notes,
      })
      .from(schema.articleMentionPerson)
      .innerJoin(schema.article, eq(schema.article.id, schema.articleMentionPerson.articleId))
      .innerJoin(schema.person, eq(schema.person.id, schema.articleMentionPerson.personId))
      .where(eq(schema.articleMentionPerson.articleId, articleId)),
  ]);

  const mentions = [
    ...workMentions.map((mention) => ({ ...mention, targetType: "work" })),
    ...eventMentions.map(({ eventName, eventDate, ...mention }) => ({
      ...mention,
      targetType: "event",
      targetName: eventName ?? eventDate,
    })),
    ...personMentions.map((mention) => ({ ...mention, targetType: "person" })),
  ].sort(
    (left, right) =>
      left.targetType.localeCompare(right.targetType) ||
      left.targetName.localeCompare(right.targetName, "ja"),
  );

  return { issue, mentions };
}

function selectionClause(select: Record<string, SQLWrapper>) {
  return sql.join(
    Object.entries(select).map(([alias, expression]) => sql`${expression} as ${sql.identifier(alias)}`),
    sql`, `,
  );
}

function searchClause(columns: SQLWrapper[], search: string) {
  if (!search) return sql.empty();
  return sql`where concat_ws(' ', ${sql.join(columns, sql`, `)}) ilike ${`%${search}%`}`;
}

function resultRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: Array<Record<string, unknown>> }).rows;
  }
  return [];
}

function allArticleMentions() {
  return sql`
    select am.id, am.article_id as "articleId", a.title as "articleTitle",
      'work' as "targetType", am.work_id as "targetId", w.title as "targetName",
      am.mention_type as "mentionType", am.notes
    from article_mention_work am join article a on a.id = am.article_id join work w on w.id = am.work_id
    union all
    select am.id, am.article_id, a.title, 'event', am.event_id,
      coalesce(e.event_name, e.event_date::text), am.mention_type, am.notes
    from article_mention_event am join article a on a.id = am.article_id join event e on e.id = am.event_id
    union all
    select am.id, am.article_id, a.title, 'person', am.person_id, p.name,
      am.mention_type, am.notes
    from article_mention_person am join article a on a.id = am.article_id join person p on p.id = am.person_id
  `;
}

function mentionTable(targetType: string): PgTable {
  switch (targetType) {
    case "work":
      return schema.articleMentionWork;
    case "event":
      return schema.articleMentionEvent;
    case "person":
      return schema.articleMentionPerson;
    default:
      throw new Error(`Unsupported mention target type: ${targetType}`);
  }
}

function mentionTargetColumn(targetType: string) {
  switch (targetType) {
    case "work":
      return "workId";
    case "event":
      return "eventId";
    case "person":
      return "personId";
    default:
      throw new Error(`Unsupported mention target type: ${targetType}`);
  }
}
