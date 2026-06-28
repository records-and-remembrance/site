import { describe, expect, test } from 'bun:test';
import { buildInitialValues, buildPayload, hasUnsavedChanges, withParentValue } from './form-state';
import { editorConfigs } from './resources';

describe('admin form state', () => {
	test('normalizes database nulls and checkbox values for editing', () => {
		expect(
			buildInitialValues(editorConfigs.events.fields, {
				eventName: null,
				encore: null,
				ticketPrice: 3200,
			}),
		).toMatchObject({
			eventName: '',
			ticketPrice: '3200',
		});
	});

	test('converts empty optional fields and numeric fields for the API', () => {
		expect(
			buildPayload(editorConfigs.events.fields, {
				projectId: 'project-id',
				venueId: 'venue-id',
				type: 'live',
				eventName: '',
				eventDate: '2026-06-28',
				ticketPrice: '3200',
			}),
		).toMatchObject({
			eventName: null,
			ticketPrice: 3200,
		});
	});

	test('expands a human-readable target selector into API target fields', () => {
		expect(
			buildPayload(editorConfigs.contributions.fields, {
				personId: 'person-id',
				roleId: 'role-id',
				instrumentId: '',
				targetType: 'release',
				targetId: 'release-id',
				notes: '',
			}),
		).toEqual({
			personId: 'person-id',
			roleId: 'role-id',
			instrumentId: null,
			recordingId: null,
			releaseId: 'release-id',
			eventId: null,
			notes: null,
		});
	});

	test('injects parent IDs and detects unsaved edits', () => {
		const initial = withParentValue({ personId: '' }, 'personId', 'person-1');
		expect(initial).toEqual({ personId: 'person-1' });
		expect(hasUnsavedChanges(initial, { personId: 'person-1' })).toBe(false);
		expect(hasUnsavedChanges(initial, { personId: 'person-2' })).toBe(true);
	});
});
