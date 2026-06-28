import { describe, expect, test } from 'bun:test';
import { compilationProjectNames, releaseEditionType, workType, type SourceArticle } from './generate_rawdata_seed_sql';

const source = (overrides: Partial<SourceArticle>): SourceArticle => ({
	path: 'release.md',
	name: 'release.md',
	stem: 'release',
	title: 'Artist - Album',
	date: '2025-01-01',
	tags: ['Release', 'Artist'],
	body: '',
	...overrides,
});

describe('release classification', () => {
	test('classifies multi-artist VA works and extracts every participant', () => {
		const value = source({
			title: 'VA - Festival compilation',
			tags: ['Release', 'Artist A', 'Artist B', 'Artist C', 'Self-Release', 'Compilation'],
		});

		expect(workType(value)).toBe('compilation');
		expect(compilationProjectNames(value)).toEqual(['Artist A', 'Artist B', 'Artist C']);
	});

	test('classifies same-artist edited works as best albums', () => {
		expect(
			workType(
				source({
					title: 'Artist - Edited catalogue',
					tags: ['Release', 'Artist', 'Compilation', 'Reissue/Remaster'],
				}),
			),
		).toBe('best');
		expect(workType(source({ title: 'Artist - BEST', body: 'メンバー選曲によるベスト盤。' }))).toBe('best');
	});

	test('classifies reissues independently from the work type', () => {
		const value = source({ tags: ['Release', 'Artist', 'Reissue/Remaster'] });

		expect(workType(value)).toBe('original');
		expect(releaseEditionType(value)).toBe('reissue');
	});
});
