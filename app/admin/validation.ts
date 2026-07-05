import { z } from 'zod';
import { recordingTypes } from '../recording/types';
import type { AdminResource } from './types';

const emptyToNull = (value: unknown) => (value === '' ? null : value);
const nullableText = z.preprocess(emptyToNull, z.string().trim().nullable().optional());
const requiredText = z.string().trim().min(1);
const uuid = z.string().uuid();
const nullableUuid = z.preprocess(emptyToNull, uuid.nullable().optional());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const nullableDate = z.preprocess(emptyToNull, date.nullable().optional());
const time = z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/, 'Use HH:MM or HH:MM:SS');
const nullableTime = z.preprocess(emptyToNull, time.nullable().optional());
const nullableInteger = z.preprocess(emptyToNull, z.coerce.number().int().nullable().optional());
const positiveInteger = z.coerce.number().int().positive();

const person = z.strictObject({
	name: requiredText,
	description: nullableText,
	birthDate: nullableDate,
	deathDate: nullableDate,
	activeFrom: nullableDate,
	activeTo: nullableDate,
});

const project = z.strictObject({
	name: requiredText,
	type: requiredText,
	description: nullableText,
	startDate: nullableDate,
	endDate: nullableDate,
});

const work = z.strictObject({
	projectId: uuid,
	title: requiredText,
	description: nullableText,
	createdDate: nullableDate,
	releasedDate: nullableDate,
	type: z.enum(['original', 'compilation', 'best', 'live']).default('original'),
});

const workProject = z.strictObject({
	workId: uuid,
	projectId: uuid,
	relationType: z.enum(['primary', 'participant']).default('primary'),
});

const event = z.strictObject({
	projectId: uuid,
	venueId: uuid,
	type: requiredText.default('live'),
	eventName: nullableText,
	eventDate: date,
	startTime: nullableTime,
	endTime: nullableTime,
	doorsOpenTime: nullableTime,
	ticketPrice: nullableInteger,
	description: nullableText,
	notes: nullableText,
});

const composition = z.strictObject({
	title: requiredText,
	description: nullableText,
});

const compositionCredit = z.strictObject({
	compositionId: uuid,
	personId: uuid,
	creditType: z.enum(['composer', 'lyricist']),
	orderIndex: positiveInteger,
});

const article = z.strictObject({
	publicationIssueId: nullableUuid,
	title: requiredText,
	type: nullableText,
	publishedDate: nullableDate,
	summary: nullableText,
	content: nullableText,
	url: z.preprocess(emptyToNull, z.string().url().nullable().optional()),
});

const contribution = z
	.strictObject({
		personId: uuid,
		roleId: uuid,
		instrumentId: nullableUuid,
		recordingId: nullableUuid,
		releaseId: nullableUuid,
		eventId: nullableUuid,
		notes: nullableText,
	})
	.refine((value) => [value.recordingId, value.releaseId, value.eventId].filter((target) => target !== null && target !== undefined).length === 1, {
		message: 'Select exactly one target',
		path: ['target'],
	});

const membership = z.strictObject({
	personId: uuid,
	projectId: uuid,
	fromDate: date,
	toDate: nullableDate,
	fromDatePrecision: nullableText,
	toDatePrecision: nullableText,
	support: z.boolean().default(false),
	note: nullableText,
});

const membershipRole = z.strictObject({
	membershipId: uuid,
	roleId: uuid,
	instrumentId: nullableUuid,
});

const release = z.strictObject({
	workId: uuid,
	format: requiredText,
	catalogNumber: nullableText,
	releaseDate: nullableDate,
	releaseDatePrecision: nullableText,
	recordedFrom: nullableDate,
	recordedTo: nullableDate,
	description: nullableText,
	notes: nullableText,
	distributorId: nullableUuid,
	editionType: z.enum(['original', 'reissue']).default('original'),
	reissueOfReleaseId: nullableUuid,
});

const labelRelation = z.strictObject({
	releaseId: uuid,
	labelId: uuid,
});

const recording = z.strictObject({
	compositionId: uuid,
	versionName: nullableText,
	versionDescription: nullableText,
	recordingYear: nullableInteger,
	type: z.enum(recordingTypes).default('studio'),
	recordedDate: nullableDate,
	recordedFrom: nullableDate,
	recordedTo: nullableDate,
	releaseDate: nullableDate,
	notes: nullableText,
});

const track = z.strictObject({
	releaseId: uuid,
	recordingId: uuid,
	trackNumber: positiveInteger,
	recordedDate: nullableDate,
	notes: nullableText,
});

const eventPerformance = z.strictObject({
	eventId: uuid,
	compositionId: uuid,
	orderIndex: positiveInteger,
	encore: z.boolean().default(false),
	variationNote: nullableText,
	notes: nullableText,
});

const publicationIssue = z.strictObject({
	publicationId: uuid,
	issueNumber: nullableText,
	volume: nullableText,
	publishedDate: nullableDate,
	description: nullableText,
});

const articleMention = z.strictObject({
	articleId: uuid,
	targetType: z.enum(['work', 'event', 'person']),
	targetId: uuid,
	mentionType: requiredText,
	notes: nullableText,
});

const venue = z.strictObject({
	name: requiredText,
	location: nullableText,
	description: nullableText,
});

const role = z.strictObject({
	name: requiredText,
	category: requiredText,
	description: nullableText,
});

const namedMaster = z.strictObject({
	name: requiredText,
	description: nullableText,
});

const publication = z.strictObject({
	name: requiredText,
	type: nullableText,
	publisher: nullableText,
	description: nullableText,
});

export const resourceSchemas: Record<AdminResource, z.ZodObject | z.ZodPipe> = {
	people: person,
	projects: project,
	works: work,
	'work-projects': workProject,
	events: event,
	compositions: composition,
	'composition-credits': compositionCredit,
	articles: article,
	contributions: contribution,
	memberships: membership,
	'membership-roles': membershipRole,
	releases: release,
	'label-relations': labelRelation,
	recordings: recording,
	tracks: track,
	'event-performances': eventPerformance,
	'publication-issues': publicationIssue,
	'article-mentions': articleMention,
	venues: venue,
	roles: role,
	instruments: namedMaster,
	labels: namedMaster,
	distributors: namedMaster,
	publications: publication,
};

export const listQuerySchema = z.strictObject({
	search: z.string().trim().default(''),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	sort: z.string().trim().min(1).optional(),
	direction: z.enum(['asc', 'desc']).default('asc'),
});
