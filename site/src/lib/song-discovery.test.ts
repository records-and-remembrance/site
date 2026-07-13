import { describe, expect, test } from 'bun:test';
import { buildSongJourney, buildSongPerformanceHistory } from './song-discovery';

describe('PST-022 song discovery', () => {
	const source = {
		eventPerformance: [
			{ id: 'p1', compositionId: 'c', eventId: 'e1', encore: false },
			{ id: 'p2', compositionId: 'c', eventId: 'e2', encore: true },
			{ id: 'p3', compositionId: 'c', eventId: 'e3', encore: false },
		],
		event: [
			{ id: 'e1', eventDate: '2010-01-01', slug: 'e1' },
			{ id: 'e2', eventDate: '2012-01-01', slug: 'e2' },
			{ id: 'e3', eventDate: '2013-01-01', slug: 'e3' },
		],
		recording: [{ id: 'recording', compositionId: 'c' }],
		track: [{ id: 'track', recordingId: 'recording', releaseId: 'release' }],
		release: [{ id: 'release', workId: 'work', releaseDate: '2009-01-01', editionKey: 'first' }],
		work: [{ id: 'work', title: 'Work', slug: 'work' }],
	};

	test('曲の旅を発売日順にし、演奏回数・初演・最終演奏・アンコール率を集計する', () => {
		expect(buildSongJourney('c', source)).toEqual([{ date: '2009-01-01', label: 'Work', href: '/discography/work#edition-first', editionKey: 'first' }]);
		const history = buildSongPerformanceHistory('c', source);
		expect(history.count).toBe(3);
		expect(history.firstDate).toBe('2010-01-01');
		expect(history.lastDate).toBe('2013-01-01');
		expect(history.encoreRate).toBeCloseTo(1 / 3);
		expect(history.revivals).toEqual([]);
	});

	test('3年以上の暦年gapだけを復活演奏として返し、録音0件でも成立する', () => {
		const history = buildSongPerformanceHistory('c', {
			...source,
			event: [
				{ id: 'e1', eventDate: '2010-01-01', slug: 'e1' },
				{ id: 'e2', eventDate: '2013-01-01', slug: 'e2' },
				{ id: 'e3', eventDate: '2013-01-01', slug: 'e3' },
			],
		});
		expect(history.revivals).toEqual([{ date: '2013-01-01', gapFrom: '2010-01-01', eventHref: '/lives/e2' }]);
		expect(buildSongJourney('c', { ...source, recording: [], track: [] })).toEqual([]);
	});
});
