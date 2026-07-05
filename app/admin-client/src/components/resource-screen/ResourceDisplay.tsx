import type { ReactNode } from 'react';
import type { ColumnConfig } from '../../resources';

export function CellValue({ value, column }: { value: unknown; column: ColumnConfig }) {
	return <span className={column.kind === 'muted' ? 'muted-value' : undefined}>{formatValue(value, column.kind)}</span>;
}

export function formatValue(value: unknown, kind?: ColumnConfig['kind']): string {
	if (value === null || value === undefined || value === '') return '—';
	if (Array.isArray(value)) {
		return (
			value
				.map((item) => {
					if (!item || typeof item !== 'object') return String(item);
					const record = item as Record<string, unknown>;
					return String(record.name ?? record.roleName ?? record.instrumentName ?? record.label ?? '');
				})
				.filter(Boolean)
				.join('、') || '—'
		);
	}
	if (kind === 'boolean') return value ? 'はい' : 'いいえ';
	if (kind === 'number' && typeof value === 'number') {
		return value.toLocaleString('ja-JP');
	}
	if (kind === 'date') {
		return String(value).slice(0, 10).replaceAll('-', '.');
	}
	return String(value);
}

export function resolvedDisplayValue(record: Record<string, unknown>, key: string): unknown {
	if (key.endsWith('Id')) {
		return record[key.replace(/Id$/, 'Name')] ?? record[key];
	}
	return record[key];
}

export function primaryLabel(record: Record<string, unknown>): string {
	return String(record.name ?? record.title ?? record.eventName ?? record.personName ?? record.id);
}

export function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
	return (
		<div className="empty-state">
			{icon}
			<span>{text}</span>
		</div>
	);
}
