import { eq } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import type { AdminDb, RelatedLoader } from '../types';

export const createArticleRelatedLoader =
	(database: AdminDb): RelatedLoader =>
	async (articleId) => {
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
				.innerJoin(schema.publicationIssue, eq(schema.publicationIssue.id, schema.article.publicationIssueId))
				.innerJoin(schema.publication, eq(schema.publication.id, schema.publicationIssue.publicationId))
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
			...workMentions.map((mention) => ({ ...mention, targetType: 'work' })),
			...eventMentions.map(({ eventName, eventDate, ...mention }) => ({
				...mention,
				targetType: 'event',
				targetName: eventName ?? eventDate,
			})),
			...personMentions.map((mention) => ({ ...mention, targetType: 'person' })),
		].sort((left, right) => left.targetType.localeCompare(right.targetType) || left.targetName.localeCompare(right.targetName, 'ja'));

		return { issue, mentions };
	};
