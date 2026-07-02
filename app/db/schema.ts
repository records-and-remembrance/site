import { sql } from 'drizzle-orm';
import { boolean, check, date, integer, pgTable, text, time, timestamp, unique, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';

const dateString = (name: string) => date(name, { mode: 'string' });
const timeString = (name: string) => time(name);
const timestampString = (name: string) => timestamp(name, { mode: 'string' });

/** 個人（ミュージシャン、スタッフなど） */
export const person = pgTable(
	'person',
	{
		id: uuid('id').primaryKey(),
		/** 表示名 */
		name: text('name').notNull(),
		/** 人物の説明 */
		description: text('description'),
		/** 生年月日 */
		birthDate: dateString('birth_date'),
		/** 死亡日 */
		deathDate: dateString('death_date'),
		/** 活動開始時期 */
		activeFrom: dateString('active_from'),
		/** 活動終了時期 */
		activeTo: dateString('active_to'),
	},
	(table) => [unique('person_name_unique').on(table.name)],
);

/** 活動単位（バンド、ソロ、ユニット） */
export const project = pgTable(
	'project',
	{
		id: uuid('id').primaryKey(),
		name: text('name').notNull(),
		/** 活動形態（band / solo 等） */
		type: text('type').notNull(),
		description: text('description'),
		startDate: dateString('start_date'),
		endDate: dateString('end_date'),
	},
	(table) => [unique('project_name_unique').on(table.name), check('project_end_date_check', sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`)],
);

/** プロジェクトへの参加期間 */
export const membership = pgTable(
	'membership',
	{
		id: uuid('id').primaryKey(),
		personId: uuid('person_id')
			.notNull()
			.references(() => person.id),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id),
		fromDate: dateString('from_date').notNull(),
		toDate: dateString('to_date'),
		fromDatePrecision: text('from_date_precision'),
		toDatePrecision: text('to_date_precision'),
		/** サポートメンバーかどうか */
		support: boolean('support').notNull().default(false),
		note: text('note'),
	},
	(table) => [
		unique('membership_person_project_from_date_unique').on(table.personId, table.projectId, table.fromDate),
		check('membership_to_date_check', sql`${table.toDate} IS NULL OR ${table.toDate} >= ${table.fromDate}`),
	],
);

/** 役割（performer, producer など） */
export const role = pgTable(
	'role',
	{
		id: uuid('id').primaryKey(),
		name: text('name').notNull(),
		category: text('category').notNull(),
		description: text('description'),
	},
	(table) => [unique('role_name_unique').on(table.name)],
);

/** 楽器 */
export const instrument = pgTable(
	'instrument',
	{
		id: uuid('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description'),
	},
	(table) => [unique('instrument_name_unique').on(table.name)],
);

/** 参加期間中の役割 */
export const membershipRole = pgTable(
	'membership_role',
	{
		id: uuid('id').primaryKey(),
		membershipId: uuid('membership_id')
			.notNull()
			.references(() => membership.id, { onDelete: 'cascade' }),
		roleId: uuid('role_id')
			.notNull()
			.references(() => role.id),
		instrumentId: uuid('instrument_id').references(() => instrument.id),
	},
	(table) => [unique('membership_role_unique').on(table.membershipId, table.roleId, table.instrumentId)],
);

/** 抽象作品（アルバム単位） */
export const work = pgTable(
	'work',
	{
		id: uuid('id').primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id),
		title: text('title').notNull(),
		description: text('description'),
		createdDate: dateString('created_date'),
		releasedDate: dateString('released_date'),
		type: text('type').notNull().default('original'),
	},
	(table) => [unique('work_project_title_unique').on(table.projectId, table.title), check('work_type_check', sql`${table.type} IN ('original', 'compilation', 'best', 'live')`)],
);

/** 作品に関係するプロジェクト（主名義、参加アーティスト） */
export const workProject = pgTable(
	'work_project',
	{
		id: uuid('id').primaryKey(),
		workId: uuid('work_id')
			.notNull()
			.references(() => work.id, { onDelete: 'cascade' }),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id),
		relationType: text('relation_type').notNull().default('primary'),
	},
	(table) => [unique('work_project_work_project_unique').on(table.workId, table.projectId), check('work_project_relation_type_check', sql`${table.relationType} IN ('primary', 'participant')`)],
);

export const distributor = pgTable(
	'distributor',
	{
		id: uuid('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description'),
	},
	(table) => [unique('distributor_name_unique').on(table.name)],
);

/** 具体リリース（CD, 配信など） */
export const release = pgTable(
	'release',
	{
		id: uuid('id').primaryKey(),
		workId: uuid('work_id')
			.notNull()
			.references(() => work.id),
		format: text('format').notNull(),
		catalogNumber: text('catalog_number'),
		releaseDate: dateString('release_date'),
		releaseDatePrecision: text('release_date_precision'),
		recordedFrom: dateString('recorded_from'),
		recordedTo: dateString('recorded_to'),
		description: text('description'),
		notes: text('notes'),
		distributorId: uuid('distributor_id').references(() => distributor.id),
		editionType: text('edition_type').notNull().default('original'),
		reissueOfReleaseId: uuid('reissue_of_release_id').references((): AnyPgColumn => release.id),
	},
	(table) => [
		unique('release_work_format_release_date_unique').on(table.workId, table.format, table.releaseDate),
		check('release_recorded_to_check', sql`${table.recordedTo} IS NULL OR ${table.recordedTo} >= ${table.recordedFrom}`),
		check('release_edition_type_check', sql`${table.editionType} IN ('original', 'reissue')`),
		check('release_reissue_source_check', sql`${table.reissueOfReleaseId} IS NULL OR ${table.reissueOfReleaseId} <> ${table.id}`),
	],
);

export const label = pgTable(
	'label',
	{
		id: uuid('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description'),
	},
	(table) => [unique('label_name_unique').on(table.name)],
);

export const labelRelation = pgTable(
	'label_relation',
	{
		id: uuid('id').primaryKey(),
		releaseId: uuid('release_id')
			.notNull()
			.references(() => release.id, { onDelete: 'cascade' }),
		labelId: uuid('label_id')
			.notNull()
			.references(() => label.id),
	},
	(table) => [unique('label_relation_release_label_unique').on(table.releaseId, table.labelId)],
);

/** 楽曲（抽象） */
export const composition = pgTable(
	'composition',
	{
		id: uuid('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description'),
	},
	(table) => [unique('composition_title_unique').on(table.title)],
);

/** 楽曲ごとの録音割り当てレビュー状態 */
export const recordingReview = pgTable('recording_review', {
	compositionId: uuid('composition_id')
		.primaryKey()
		.references(() => composition.id, { onDelete: 'cascade' }),
	assignmentFingerprint: text('assignment_fingerprint').notNull(),
	reviewedAt: timestampString('reviewed_at').notNull(),
});

/** 録音単位（アレンジ・バージョン） */
export const recording = pgTable(
	'recording',
	{
		id: uuid('id').primaryKey(),
		compositionId: uuid('composition_id')
			.notNull()
			.references(() => composition.id),
		versionName: text('version_name'),
		versionDescription: text('version_description'),
		recordingYear: integer('recording_year'),
		type: text('type').notNull().default('studio'),
		recordedDate: dateString('recorded_date'),
		recordedFrom: dateString('recorded_from'),
		recordedTo: dateString('recorded_to'),
		releaseDate: dateString('release_date'),
		notes: text('notes'),
	},
	(table) => [
		check('recording_recorded_to_check', sql`${table.recordedTo} IS NULL OR ${table.recordedTo} >= ${table.recordedFrom}`),
		check('recording_type_check', sql`${table.type} IN ('studio', 'live', 'demo', 'rehearsal', 'other')`),
	],
);

/** リリース内の曲順 */
export const track = pgTable(
	'track',
	{
		id: uuid('id').primaryKey(),
		releaseId: uuid('release_id')
			.notNull()
			.references(() => release.id, { onDelete: 'cascade' }),
		recordingId: uuid('recording_id')
			.notNull()
			.references(() => recording.id),
		trackNumber: integer('track_number').notNull(),
		recordedDate: dateString('recorded_date'),
		notes: text('notes'),
	},
	(table) => [unique('track_release_track_number_unique').on(table.releaseId, table.trackNumber), check('track_track_number_check', sql`${table.trackNumber} > 0`)],
);

export const venue = pgTable(
	'venue',
	{
		id: uuid('id').primaryKey(),
		name: text('name').notNull(),
		location: text('location'),
		description: text('description'),
	},
	(table) => [unique('venue_name_location_unique').on(table.name, table.location)],
);

/** ライブ・公演 */
export const event = pgTable(
	'event',
	{
		id: uuid('id').primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id),
		venueId: uuid('venue_id')
			.notNull()
			.references(() => venue.id),
		/** イベント種別（live / exhibition / listening_event 等） */
		type: text('type').notNull().default('live'),
		eventName: text('event_name'),
		eventDate: dateString('event_date').notNull(),
		startTime: timeString('start_time'),
		endTime: timeString('end_time'),
		doorsOpenTime: timeString('doors_open_time'),
		ticketPrice: integer('ticket_price'),
		description: text('description'),
		notes: text('notes'),
	},
	(table) => [unique('event_project_venue_event_date_unique').on(table.projectId, table.venueId, table.eventDate)],
);

/** セットリスト */
export const eventPerformance = pgTable(
	'event_performance',
	{
		id: uuid('id').primaryKey(),
		eventId: uuid('event_id')
			.notNull()
			.references(() => event.id, { onDelete: 'cascade' }),
		compositionId: uuid('composition_id')
			.notNull()
			.references(() => composition.id),
		orderIndex: integer('order_index').notNull(),
		encore: boolean('encore').notNull().default(false),
		variationNote: text('variation_note'),
		notes: text('notes'),
	},
	(table) => [unique('event_performance_event_order_index_unique').on(table.eventId, table.orderIndex), check('event_performance_order_index_check', sql`${table.orderIndex} > 0`)],
);

/** 関与（誰が何にどの役割で関与したか） */
export const contribution = pgTable(
	'contribution',
	{
		id: uuid('id').primaryKey(),
		personId: uuid('person_id')
			.notNull()
			.references(() => person.id),
		roleId: uuid('role_id')
			.notNull()
			.references(() => role.id),
		instrumentId: uuid('instrument_id').references(() => instrument.id),
		recordingId: uuid('recording_id').references(() => recording.id),
		releaseId: uuid('release_id').references(() => release.id),
		eventId: uuid('event_id').references(() => event.id),
		notes: text('notes'),
	},
	(table) => [check('contribution_single_target_check', sql`((${table.recordingId} IS NOT NULL)::int + (${table.releaseId} IS NOT NULL)::int + (${table.eventId} IS NOT NULL)::int) = 1`)],
);

/** 媒体（雑誌、ウェブサイト） */
export const publication = pgTable(
	'publication',
	{
		id: uuid('id').primaryKey(),
		name: text('name').notNull(),
		type: text('type'),
		publisher: text('publisher'),
		description: text('description'),
	},
	(table) => [unique('publication_name_unique').on(table.name)],
);

/** 雑誌の号・巻 */
export const publicationIssue = pgTable('publication_issue', {
	id: uuid('id').primaryKey(),
	publicationId: uuid('publication_id')
		.notNull()
		.references(() => publication.id),
	issueNumber: text('issue_number'),
	volume: text('volume'),
	publishedDate: dateString('published_date'),
	description: text('description'),
});

/** 記事（雑誌記事・Web記事） */
export const article = pgTable('article', {
	id: uuid('id').primaryKey(),
	publicationIssueId: uuid('publication_issue_id').references(() => publicationIssue.id),
	title: text('title').notNull(),
	type: text('type'),
	publishedDate: dateString('published_date'),
	summary: text('summary'),
	content: text('content'),
	url: text('url'),
	createdAt: timestampString('created_at').defaultNow(),
	updatedAt: timestampString('updated_at').defaultNow(),
});

export const articleMentionWork = pgTable(
	'article_mention_work',
	{
		id: uuid('id').primaryKey(),
		articleId: uuid('article_id')
			.notNull()
			.references(() => article.id, { onDelete: 'cascade' }),
		workId: uuid('work_id')
			.notNull()
			.references(() => work.id),
		mentionType: text('mention_type').notNull(),
		notes: text('notes'),
	},
	(table) => [unique('article_mention_work_unique').on(table.articleId, table.workId, table.mentionType)],
);

export const articleMentionEvent = pgTable(
	'article_mention_event',
	{
		id: uuid('id').primaryKey(),
		articleId: uuid('article_id')
			.notNull()
			.references(() => article.id, { onDelete: 'cascade' }),
		eventId: uuid('event_id')
			.notNull()
			.references(() => event.id),
		mentionType: text('mention_type').notNull(),
		notes: text('notes'),
	},
	(table) => [unique('article_mention_event_unique').on(table.articleId, table.eventId, table.mentionType)],
);

export const articleMentionPerson = pgTable(
	'article_mention_person',
	{
		id: uuid('id').primaryKey(),
		articleId: uuid('article_id')
			.notNull()
			.references(() => article.id, { onDelete: 'cascade' }),
		personId: uuid('person_id')
			.notNull()
			.references(() => person.id),
		mentionType: text('mention_type').notNull(),
		notes: text('notes'),
	},
	(table) => [unique('article_mention_person_unique').on(table.articleId, table.personId, table.mentionType)],
);

export type Person = typeof person.$inferSelect;
export type NewPerson = typeof person.$inferInsert;
export type Project = typeof project.$inferSelect;
export type Work = typeof work.$inferSelect;
export type Release = typeof release.$inferSelect;
export type Article = typeof article.$inferSelect;
export type Contribution = typeof contribution.$inferSelect;
