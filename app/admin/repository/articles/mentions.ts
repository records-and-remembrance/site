import { sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../../../db/schema';
import type { AdminListQuery, AdminListResult } from '../../types';
import { resultRows, tableId } from '../sql';
import type { AdminDb } from '../types';

const allArticleMentions = () => sql`
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

function mentionTable(targetType: string): PgTable {
	switch (targetType) {
		case 'work':
			return schema.articleMentionWork;
		case 'event':
			return schema.articleMentionEvent;
		case 'person':
			return schema.articleMentionPerson;
		default:
			throw new Error(`Unsupported mention target type: ${targetType}`);
	}
}

function mentionTargetColumn(targetType: string) {
	switch (targetType) {
		case 'work':
			return 'workId';
		case 'event':
			return 'eventId';
		case 'person':
			return 'personId';
		default:
			throw new Error(`Unsupported mention target type: ${targetType}`);
	}
}

export const createArticleMentionRepository = (database: AdminDb) => {
	const list = async (query: AdminListQuery): Promise<AdminListResult> => {
		const search = `%${query.search}%`;
		const offset = (query.page - 1) * query.pageSize;
		const filter = query.search ? sql`where concat_ws(' ', "articleTitle", "targetName", "mentionType", notes) ilike ${search}` : sql.empty();
		const union = allArticleMentions();
		const [itemsResult, countResult] = await Promise.all([
			database.execute(sql`
				select * from (${union}) mentions
				${filter}
				order by "mentionType", "targetName"
				limit ${query.pageSize} offset ${offset}
			`),
			database.execute(sql`select count(*)::int as total from (${union}) mentions ${filter}`),
		]);
		return {
			items: resultRows(itemsResult),
			total: Number(resultRows(countResult)[0]?.['total'] ?? 0),
		};
	};

	const detail = async (id: string) => {
		const result = await database.execute(sql`
			select * from (${allArticleMentions()}) mentions where id = ${id} limit 1
		`);
		return resultRows(result)[0] ?? null;
	};

	const create = async (value: Record<string, unknown>) => {
		const { targetType, targetId, ...common } = value;
		const table = mentionTable(String(targetType));
		const targetColumn = mentionTargetColumn(String(targetType));
		const rows = await database
			.insert(table)
			.values({ ...common, [targetColumn]: targetId })
			.returning();
		return { ...rows[0], targetType, targetId };
	};

	const update = async (id: string, value: Record<string, unknown>) => {
		const existing = await detail(id);
		if (!existing) return null;
		if (existing['targetType'] !== value['targetType']) {
			const error = new Error('Changing mention target type is not supported');
			Object.assign(error, { code: '23514', constraint: 'article_mention_target_type' });
			throw error;
		}
		const { targetType, targetId, ...common } = value;
		const table = mentionTable(String(targetType));
		const targetColumn = mentionTargetColumn(String(targetType));
		const rows = await database
			.update(table)
			.set({ ...common, [targetColumn]: targetId })
			.where(sql`${tableId(table)} = ${id}`)
			.returning();
		return rows[0] ? { ...rows[0], targetType, targetId } : null;
	};

	return { list, detail, create, update };
};
