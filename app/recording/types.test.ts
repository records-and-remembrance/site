import { describe, expect, test } from 'bun:test';
import { recordingTypes } from './types';

describe('recording types', () => {
	test('defines the complete non-null recording type vocabulary', () => {
		expect(recordingTypes).toEqual(['studio', 'live', 'demo', 'rehearsal', 'other']);
		expect(recordingTypes).not.toContain('unknown');
	});
});
