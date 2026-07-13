import { describe, expect, test } from 'bun:test';
import { buildDiscographyCards } from './discography';

describe('PST-011 discography index', () => {
	test('作品ごとに代表版・画像メタデータ・slug hrefを組み立て、未確定slugはリンクにしない', () => {
		const cards = buildDiscographyCards(
			[
				{ id: 'work-2', projectId: 'project-1', title: 'Second', slug: null },
				{ id: 'work-1', projectId: 'project-1', title: 'First', slug: 'first' },
			],
			[
				{ id: 'release-2', workId: 'work-1', format: '配信', releaseDate: '2021-01-01', artworkUrl: null, artworkWidth: null, artworkHeight: null },
				{ id: 'release-1', workId: 'work-1', format: 'CD', releaseDate: '2020-01-01', artworkUrl: 'https://cdn.example.test/first.jpg', artworkWidth: 600, artworkHeight: 400 },
			],
			[{ id: 'project-1', name: 'BURGER NUDS', slug: 'burger-nuds' }],
		);

		expect(cards).toEqual([
			{
				id: 'work-1',
				title: 'First',
				slug: 'first',
				href: '/discography/first',
				projectName: 'BURGER NUDS',
				projectSlug: 'burger-nuds',
				releaseDate: '2020-01-01',
				releaseDatePrecision: null,
				format: 'CD',
				artworkUrl: 'https://cdn.example.test/first.jpg',
				artworkWidth: 600,
				artworkHeight: 400,
				filterValues: { project: ['burger-nuds'], format: ['CD', '配信'], decade: ['2020s'], editionType: [] },
			},
			{
				id: 'work-2',
				title: 'Second',
				slug: null,
				href: undefined,
				projectName: 'BURGER NUDS',
				projectSlug: 'burger-nuds',
				releaseDate: null,
				releaseDatePrecision: null,
				format: null,
				artworkUrl: null,
				artworkWidth: null,
				artworkHeight: null,
				filterValues: { project: ['burger-nuds'], format: [], decade: [], editionType: [] },
			},
		]);
	});
});
