import { getTableColumns, sql, type SQLWrapper } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

export function tableId(table: PgTable): SQLWrapper {
	const id = getTableColumns(table)['id'];
	if (!id) throw new Error('Admin resource table has no id column');
	return id;
}

export function selectionClause(select: Record<string, SQLWrapper>) {
	return sql.join(
		Object.entries(select).map(([alias, expression]) => sql`${expression} as ${sql.identifier(alias)}`),
		sql`, `,
	);
}

export function searchClause(columns: SQLWrapper[], search: string) {
	if (!search) return sql.empty();
	return sql`where concat_ws(' ', ${sql.join(columns, sql`, `)}) ilike ${`%${search}%`}`;
}

export function resultRows(result: unknown): Array<Record<string, unknown>> {
	if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
	if (result && typeof result === 'object' && 'rows' in result) {
		return (result as { rows: Array<Record<string, unknown>> }).rows;
	}
	return [];
}
