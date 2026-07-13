import { describe, expect, test } from 'bun:test';
import { editorConfigs } from '../../resources';
import { buildInitialValues, buildPayload, hasUnsavedChanges, resolvedLookupLabel, withParentValue } from './state';

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

	test('resolves the current lookup label from either a name or a title', () => {
		expect(resolvedLookupLabel({ projectName: 'BURGER NUDS' }, 'projectId')).toBe('BURGER NUDS');
		expect(resolvedLookupLabel({ compositionTitle: 'ANALYZE' }, 'compositionId')).toBe('ANALYZE');
		expect(resolvedLookupLabel(undefined, 'compositionId')).toBe('');
	});

	test('keeps artwork upload out of the regular release JSON payload', () => {
		const payload = buildPayload(editorConfigs.releases.fields, {
			workId: 'work-id',
			format: 'CD',
			catalogNumber: '',
			releaseDate: '',
			editionType: 'original',
			reissueOfReleaseId: '',
			releaseDatePrecision: '',
			recordedFrom: '',
			recordedTo: '',
			distributorId: '',
			description: '',
			notes: '',
			artworkUrl: 'https://cdn.example/old.jpg',
		});

		expect(payload).not.toHaveProperty('artworkUrl');
	});
});
