import type { FieldConfig } from './resources';

export type FormValues = Record<string, string | boolean>;

export function buildInitialValues(fields: FieldConfig[], record: Record<string, unknown> = {}): FormValues {
	const values: FormValues = {};

	for (const field of fields) {
		if (field.type === 'target') {
			const target = targetFromRecord(record);
			values.targetType = target.type;
			values.targetId = target.id;
			continue;
		}

		const value = record[field.key];
		if (field.type === 'checkbox') {
			values[field.key] = value === true;
		} else if (value === null || value === undefined) {
			values[field.key] = field.type === 'select' && field.required ? (field.options?.[0]?.value ?? '') : '';
		} else {
			values[field.key] = String(value);
		}
	}

	return values;
}

export function buildPayload(fields: FieldConfig[], values: FormValues): Record<string, unknown> {
	const payload: Record<string, unknown> = {};

	for (const field of fields) {
		if (field.type === 'target') {
			continue;
		}

		const value = values[field.key];
		if (field.type === 'checkbox') {
			payload[field.key] = value === true;
		} else if (field.type === 'number') {
			payload[field.key] = value === '' || value === undefined ? null : Number(value);
		} else {
			payload[field.key] = value === '' || value === undefined ? (field.required ? '' : null) : value;
		}
	}

	if (fields.some((field) => field.type === 'target')) {
		const targetType = String(values.targetType ?? '');
		const targetId = String(values.targetId ?? '');

		if (fields.some((field) => field.key === 'roleId')) {
			payload.recordingId = targetType === 'recording' ? targetId : null;
			payload.releaseId = targetType === 'release' ? targetId : null;
			payload.eventId = targetType === 'event' ? targetId : null;
		} else {
			payload.targetType = targetType;
			payload.targetId = targetId;
		}
	}

	return payload;
}

export function withParentValue(values: FormValues, parentField: string, parentId: string): FormValues {
	return { ...values, [parentField]: parentId };
}

export function hasUnsavedChanges(initial: FormValues, current: FormValues): boolean {
	return JSON.stringify(initial) !== JSON.stringify(current);
}

function targetFromRecord(record: Record<string, unknown>): { type: string; id: string } {
	if (record.targetType && record.targetId) {
		return { type: String(record.targetType), id: String(record.targetId) };
	}

	for (const type of ['recording', 'release', 'event'] as const) {
		const id = record[`${type}Id`];
		if (id) {
			return { type, id: String(id) };
		}
	}

	return { type: 'release', id: '' };
}
