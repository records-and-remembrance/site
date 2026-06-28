import { getTableColumns, sql, type SQL } from "drizzle-orm";
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

interface ResourceDefinition {
  table: PgTable;
  from: SQL;
  select: Record<string, SQL>;
  searchColumns: SQL[];
  sortColumns: Record<string, SQL>;
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
const resource = (
  table: PgTable,
  from: string,
  select: Record<string, string>,
  searchColumns: string[],
  sortColumns: Record<string, string>,
  defaultSort: string,
): ResourceDefinition => ({
  table,
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

export const resourceDefinitions: Record<AdminResource, ResourceDefinition> = {
  people: resource(
    schema.person,
    "person p",
    {
      id: "p.id",
      name: "p.name",
      description: "p.description",
      birthDate: "p.birth_date",
      deathDate: "p.death_date",
      activeFrom: "p.active_from",
      activeTo: "p.active_to",
    },
    ["p.name", "p.description"],
    { name: "p.name", birthDate: "p.birth_date", activeFrom: "p.active_from" },
    "name",
  ),
  projects: resource(
    schema.project,
    "project p",
    {
      id: "p.id",
      name: "p.name",
      type: "p.type",
      description: "p.description",
      startDate: "p.start_date",
      endDate: "p.end_date",
    },
    ["p.name", "p.type", "p.description"],
    { name: "p.name", type: "p.type", startDate: "p.start_date" },
    "name",
  ),
  works: resource(
    schema.work,
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
  events: resource(
    schema.event,
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
  compositions: resource(
    schema.composition,
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
  articles: resource(
    schema.article,
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
  contributions: resource(
    schema.contribution,
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
  memberships: resource(
    schema.membership,
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
      note: "m.note",
    },
    ["pe.name", "pr.name", "m.note"],
    { id: "m.id", personName: "pe.name", projectName: "pr.name", fromDate: "m.from_date" },
    "fromDate",
  ),
  "membership-roles": resource(
    schema.membershipRole,
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
  releases: resource(
    schema.release,
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
  "label-relations": resource(
    schema.labelRelation,
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
  recordings: resource(
    schema.recording,
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
  tracks: resource(
    schema.track,
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
  "event-performances": resource(
    schema.eventPerformance,
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
  "publication-issues": resource(
    schema.publicationIssue,
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
  "article-mentions": resource(
    schema.articleMentionWork,
    "article_mention_work am",
    {
      id: "am.id",
      articleId: "am.article_id",
      targetType: "'work'",
      targetId: "am.work_id",
      mentionType: "am.mention_type",
      notes: "am.notes",
    },
    ["am.mention_type", "am.notes"],
    { mentionType: "am.mention_type" },
    "mentionType",
  ),
  venues: resource(
    schema.venue,
    "venue v",
    { id: "v.id", name: "v.name", location: "v.location", description: "v.description" },
    ["v.name", "v.location", "v.description"],
    { name: "v.name", location: "v.location" },
    "name",
  ),
  roles: resource(
    schema.role,
    "role r",
    { id: "r.id", name: "r.name", category: "r.category", description: "r.description" },
    ["r.name", "r.category", "r.description"],
    { name: "r.name", category: "r.category" },
    "name",
  ),
  instruments: resource(
    schema.instrument,
    "instrument i",
    { id: "i.id", name: "i.name", description: "i.description" },
    ["i.name", "i.description"],
    { name: "i.name" },
    "name",
  ),
  labels: resource(
    schema.label,
    "label l",
    { id: "l.id", name: "l.name", description: "l.description" },
    ["l.name", "l.description"],
    { name: "l.name" },
    "name",
  ),
  distributors: resource(
    schema.distributor,
    "distributor d",
    { id: "d.id", name: "d.name", description: "d.description" },
    ["d.name", "d.description"],
    { name: "d.name" },
    "name",
  ),
  publications: resource(
    schema.publication,
    "publication p",
    {
      id: "p.id",
      name: "p.name",
      type: "p.type",
      publisher: "p.publisher",
      description: "p.description",
    },
    ["p.name", "p.type", "p.publisher", "p.description"],
    { name: "p.name", type: "p.type", publisher: "p.publisher" },
    "name",
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
  description: description ? raw(description) : undefined,
  searchColumns: searchColumns.map(raw),
});

export const lookupDefinitions: Record<LookupResource, LookupDefinition> = {
  project: lookup(schema.project, "project p", "p.id", "p.name", ["p.name", "p.type"], "p.type"),
  person: lookup(schema.person, "person p", "p.id", "p.name", ["p.name"], "p.description"),
  composition: lookup(schema.composition, "composition c", "c.id", "c.title", ["c.title"], "c.description"),
  work: lookup(schema.work, "work w join project p on p.id = w.project_id", "w.id", "w.title || ' — ' || p.name", ["w.title", "p.name"], "p.name"),
  release: lookup(schema.release, "release r join work w on w.id = r.work_id", "r.id", "w.title || ' (' || r.format || ')'", ["w.title", "r.format", "r.catalog_number"], "r.catalog_number"),
  recording: lookup(schema.recording, "recording r join composition c on c.id = r.composition_id", "r.id", "c.title || coalesce(' (' || r.type || ')', '')", ["c.title", "r.type", "r.notes"], "r.notes"),
  "publication-issue": lookup(schema.publicationIssue, "publication_issue pi join publication p on p.id = pi.publication_id", "pi.id", "p.name || coalesce(' ' || pi.issue_number, '') || coalesce(' ' || pi.published_date::text, '')", ["p.name", "pi.issue_number", "pi.volume", "pi.published_date::text"], "pi.description"),
  venue: lookup(schema.venue, "venue v", "v.id", "v.name || coalesce(' — ' || v.location, '')", ["v.name", "v.location"], "v.location"),
  role: lookup(schema.role, "role r", "r.id", "r.name", ["r.name", "r.category"], "r.category"),
  instrument: lookup(schema.instrument, "instrument i", "i.id", "i.name", ["i.name"], "i.description"),
  label: lookup(schema.label, "label l", "l.id", "l.name", ["l.name"], "l.description"),
  distributor: lookup(schema.distributor, "distributor d", "d.id", "d.name", ["d.name"], "d.description"),
  publication: lookup(schema.publication, "publication p", "p.id", "p.name", ["p.name", "p.publisher"], "p.publisher"),
};

type AdminDb = typeof defaultDb;

export class DrizzleAdminRepository implements AdminRepository {
  constructor(private readonly database: AdminDb = defaultDb) {}

  async list(resourceName: AdminResource, query: AdminListQuery): Promise<AdminListResult> {
    if (resourceName === "article-mentions") {
      return await this.listArticleMentions(query);
    }

    const definition = resourceDefinitions[resourceName];
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
      total: Number(resultRows(countResult)[0]?.total ?? 0),
    };
  }

  async detail(resourceName: AdminResource, id: string): Promise<Record<string, unknown> | null> {
    if (resourceName === "article-mentions") {
      return await this.findArticleMention(id);
    }

    const definition = resourceDefinitions[resourceName];
    const selection = selectionClause(definition.select);
    const result = await this.database.execute(sql`
      select ${selection}
      from ${definition.from}
      where ${definition.select.id} = ${id}
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
    const definition = resourceDefinitions[resourceName];
    const rows = await this.database
      .insert(definition.table)
      .values(value)
      .returning();
    return rows[0] as Record<string, unknown>;
  }

  async update(resourceName: AdminResource, id: string, value: Record<string, unknown>) {
    if (resourceName === "article-mentions") {
      return await this.updateArticleMention(id, value);
    }
    const definition = resourceDefinitions[resourceName];
    const rows = await this.database
      .update(definition.table)
      .set(value)
      .where(sql`${getTableColumns(definition.table).id} = ${id}`)
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
    const queries: Partial<Record<AdminResource, Record<string, SQL>>> = {
      people: {
        memberships: sql`
          select m.id, m.project_id as "projectId", p.name as "projectName",
            m.from_date as "fromDate", m.to_date as "toDate",
            m.from_date_precision as "fromDatePrecision", m.to_date_precision as "toDatePrecision",
            m.note,
            coalesce(json_agg(json_build_object(
              'id', mr.id, 'roleId', r.id, 'roleName', r.name,
              'instrumentId', i.id, 'instrumentName', i.name
            )) filter (where mr.id is not null), '[]') as roles
          from membership m
          join project p on p.id = m.project_id
          left join membership_role mr on mr.membership_id = m.id
          left join role r on r.id = mr.role_id
          left join instrument i on i.id = mr.instrument_id
          where m.person_id = ${id}
          group by m.id, p.name
          order by m.from_date desc
        `,
      },
      projects: {
        members: sql`
          select m.id, m.person_id as "personId", p.name as "personName",
            m.from_date as "fromDate", m.to_date as "toDate", m.note
          from membership m join person p on p.id = m.person_id
          where m.project_id = ${id}
          order by m.from_date desc, p.name
        `,
        works: sql`
          select w.id, w.title, w.released_date as "releasedDate"
          from work w where w.project_id = ${id}
          order by w.released_date desc nulls last, w.title
        `,
        events: sql`
          select e.id, e.event_name as "eventName", e.event_date as "eventDate",
            v.name as "venueName"
          from event e join venue v on v.id = e.venue_id
          where e.project_id = ${id}
          order by e.event_date desc
        `,
      },
      works: {
        releases: sql`
          select r.id, r.format, r.catalog_number as "catalogNumber",
            r.release_date as "releaseDate", r.release_date_precision as "releaseDatePrecision",
            r.recorded_from as "recordedFrom", r.recorded_to as "recordedTo",
            r.description, r.notes, r.distributor_id as "distributorId",
            d.name as "distributorName",
            coalesce(json_agg(json_build_object('id', l.id, 'name', l.name))
              filter (where l.id is not null), '[]') as labels
          from release r
          left join distributor d on d.id = r.distributor_id
          left join label_relation lr on lr.release_id = r.id
          left join label l on l.id = lr.label_id
          where r.work_id = ${id}
          group by r.id, d.name
          order by r.release_date desc nulls last, r.format
        `,
        tracks: sql`
          select t.id, t.release_id as "releaseId", r.format,
            t.track_number as "trackNumber", rec.id as "recordingId",
            c.id as "compositionId", c.title as "compositionTitle", t.notes
          from track t
          join release r on r.id = t.release_id
          join recording rec on rec.id = t.recording_id
          join composition c on c.id = rec.composition_id
          where r.work_id = ${id}
          order by r.release_date, r.format, t.track_number
        `,
      },
      compositions: {
        recordings: sql`
          select r.id, r.recording_year as "recordingYear", r.type,
            r.recorded_date as "recordedDate", r.recorded_from as "recordedFrom",
            r.recorded_to as "recordedTo", r.release_date as "releaseDate", r.notes
          from recording r where r.composition_id = ${id}
          order by coalesce(r.recorded_date, r.release_date) desc nulls last
        `,
        appearances: sql`
          select 'release' as "type", rel.id, w.title || ' (' || rel.format || ')' as "label",
            t.track_number as "orderIndex"
          from recording rec
          join track t on t.recording_id = rec.id
          join release rel on rel.id = t.release_id
          join work w on w.id = rel.work_id
          where rec.composition_id = ${id}
          union all
          select 'event', e.id, coalesce(e.event_name, e.event_date::text), ep.order_index
          from event_performance ep join event e on e.id = ep.event_id
          where ep.composition_id = ${id}
          order by "label"
        `,
      },
      events: {
        performances: sql`
          select ep.id, ep.composition_id as "compositionId", c.title as "compositionTitle",
            ep.order_index as "orderIndex", ep.encore,
            ep.variation_note as "variationNote", ep.notes
          from event_performance ep join composition c on c.id = ep.composition_id
          where ep.event_id = ${id}
          order by ep.order_index
        `,
      },
      articles: {
        issue: sql`
          select pi.id, pi.publication_id as "publicationId", p.name as "publicationName",
            pi.issue_number as "issueNumber", pi.volume,
            pi.published_date as "publishedDate", pi.description
          from publication_issue pi join publication p on p.id = pi.publication_id
          join article a on a.publication_issue_id = pi.id
          where a.id = ${id}
        `,
        mentions: articleMentionsForArticle(id),
      },
    };

    const entries = Object.entries(queries[resourceName] ?? {});
    const results = await Promise.all(
      entries.map(async ([name, query]) => [name, resultRows(await this.database.execute(query))]),
    );
    return Object.fromEntries(results);
  }

  private async listArticleMentions(query: AdminListQuery): Promise<AdminListResult> {
    const search = `%${query.search}%`;
    const offset = (query.page - 1) * query.pageSize;
    const filter = query.search
      ? sql`where concat_ws(' ', "articleTitle", "targetName", "mentionType", notes) ilike ${search}`
      : sql.empty;
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
      total: Number(resultRows(countResult)[0]?.total ?? 0),
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
    if (existing.targetType !== value.targetType) {
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
      .where(sql`${getTableColumns(table).id} = ${id}`)
      .returning();
    return rows[0] ? { ...rows[0], targetType, targetId } : null;
  }
}

function selectionClause(select: Record<string, SQL>) {
  return sql.join(
    Object.entries(select).map(([alias, expression]) => sql`${expression} as ${sql.identifier(alias)}`),
    sql`, `,
  );
}

function searchClause(columns: SQL[], search: string) {
  if (!search) return sql.empty;
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

function articleMentionsForArticle(articleId: string) {
  return sql`select * from (${allArticleMentions()}) mentions where "articleId" = ${articleId} order by "targetType", "targetName"`;
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
