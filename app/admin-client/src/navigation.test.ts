import { describe, expect, test } from 'bun:test';
import { adminSearchParams } from './navigation';

describe('admin navigation query parsers', () => {
	test('accepts configured main resources', () => {
		expect(adminSearchParams.resource.parse('works')).toBe('works');
		expect(adminSearchParams.resource.parse('recording-organizer')).toBe('recording-organizer');
		expect(adminSearchParams.resource.parse('unknown')).toBeNull();
	});

	test('accepts editor resources as detail targets', () => {
		expect(adminSearchParams.detailResource.parse('compositions')).toBe('compositions');
		expect(adminSearchParams.detailResource.parse('unknown')).toBeNull();
	});

	test('uses people when the resource query is absent', () => {
		expect(adminSearchParams.resource.defaultValue).toBe('people');
	});
});
