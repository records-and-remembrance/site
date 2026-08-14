import type { SiteMonthDayEntry } from '../../export/export';

/** 「この日なんの日」のキー。export側の monthDay インデックスと同じ MM-DD 形式。 */
export const monthDayKey = (date: Date): string => `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const isoDateOf = (date: Date): string => `${date.getFullYear()}-${monthDayKey(date)}`;

/** 同じ月日の記録のうち、閲覧日より前のものを新しい順に返す（設計書 §4.1 の「過去イベント・リリース」）。 */
export const selectAnniversaryEntries = (entries: readonly SiteMonthDayEntry[] | undefined, today: string): SiteMonthDayEntry[] =>
	[...(entries ?? [])].filter((entry) => entry.date < today).sort((left, right) => right.date.localeCompare(left.date));

export const MONTH_DAY_KIND_LABELS: Record<SiteMonthDayEntry['type'], string> = { event: 'ライブ', release: '発売' };
