import { describe, expect, test } from 'bun:test';
import { resolveCompositionCredits, type CompositionCreditSource } from './compositionCredits';

const release = (project: string, file: string, date: string): CompositionCreditSource => ({
	type: 'release',
	project,
	file,
	date,
});

describe('resolveCompositionCredits', () => {
	test('BURGER NUDS名義を3人の作曲者へ展開する', () => {
		expect(resolveCompositionCredits('ミナソコ', [release('BURGER NUDS', '2001-07-21-000000.md', '2001-07-21')])).toEqual({
			composer: ['門田匡陽', '丸山潤', '内田武瑠'],
			lyricist: ['門田匡陽'],
		});
	});

	test('BURGER NUDS名義の作詞もメンバーへ展開する', () => {
		expect(resolveCompositionCredits('ANALYZE', [release('BURGER NUDS', '2001-10-21-000000.md', '2001-10-21')])).toEqual({
			composer: ['門田匡陽', '丸山潤', '内田武瑠'],
			lyricist: ['門田匡陽', '丸山潤', '内田武瑠'],
		});
	});

	test('無限交響楽の共同作詞者を順番どおり返す', () => {
		expect(resolveCompositionCredits('無限交響楽', [release('BURGER NUDS', '2003-08-27-000000.md', '2003-08-27')])).toEqual({
			composer: ['門田匡陽', '丸山潤', '内田武瑠'],
			lyricist: ['門田匡陽', '内田武瑠'],
		});
	});

	test('初期デモは個人名義のクレジットを優先する', () => {
		expect(resolveCompositionCredits('冷たい水', [release('BURGER NUDS', '1999-06-01-000000.md', '1999-06-01')])).toEqual({
			composer: ['門田匡陽'],
			lyricist: ['門田匡陽'],
		});
		expect(resolveCompositionCredits('UNKNOWN', [{ type: 'live', project: 'BURGER NUDS', file: 'live.md', date: '2000-01-01' }])).toEqual({
			composer: ['門田匡陽'],
			lyricist: ['門田匡陽'],
		});
	});

	test('Good Dog Happy Menの初作は4人の作曲者へ展開する', () => {
		expect(resolveCompositionCredits('息吹と共に混沌を裂いて', [release('Good Dog Happy Men', '2005-06-01-000000.md', '2005-06-01')])).toEqual({
			composer: ['門田匡陽', '韮沢雄希', '内田武瑠', '伊藤大地'],
			lyricist: ['門田匡陽'],
		});
	});

	test('後期Good Dog Happy Menとソロ作品は門田匡陽の作詞作曲とする', () => {
		expect(resolveCompositionCredits('Bit by Bit', [release('Good Dog Happy Men', '2006-04-26-000000.md', '2006-04-26')])).toEqual({
			composer: ['門田匡陽'],
			lyricist: ['門田匡陽'],
		});
		expect(resolveCompositionCredits('新しい歌', [release('Poet-type.M', '2015-01-01.md', '2015-01-01')])).toEqual({
			composer: ['門田匡陽'],
			lyricist: ['門田匡陽'],
		});
	});

	test('クレジット主体でない分類名のsourceを飛ばして有効なprojectを使う', () => {
		expect(resolveCompositionCredits('(con)crete', [release('Album', '2022-12-18-000000.md', '2022-12-18'), release('門田匡陽 (ソロ名義/2020-)', '2024-03-13-000000.md', '2024-03-13')])).toEqual({
			composer: ['門田匡陽'],
			lyricist: ['門田匡陽'],
		});
	});

	test('リリース根拠がない楽曲は推測せず、出典のあるカバー曲は原作者を返す', () => {
		expect(resolveCompositionCredits('ライブのみの曲', [{ type: 'live', project: 'BURGER NUDS', file: 'live.md', date: '2002-01-01' }])).toEqual({
			composer: [],
			lyricist: [],
		});
		expect(resolveCompositionCredits('Blue Moon', [release('門田匡陽 (ソロ名義/2010)', '2012-04-14-000001.md', '2012-04-14')])).toEqual({
			composer: ['Richard Rodgers'],
			lyricist: ['Lorenz Hart'],
		});
	});

	test.each([
		'AYATORI',
		'Beautiful Loser',
		'Clear',
		'D.O.M',
		'EXAM',
		'Ghost Of Ghost Town',
		'TOUCH',
		'omamagoto',
		'prologue -Ergonomics(s)-',
		'〜Welcome to the nightmare〜',
		'7月10日',
		'オリジナルディストピア',
		'クリスタル',
		'ディストピア',
		'ネギ',
		'ネクスト東京',
		'ラストハルマゲドン',
		'主よ、人の望みの喜びよ',
		'処分保留',
		'即興No.3',
		'堕天使達のバラッド',
		'獄才色',
		'疾れ! DOMINO!',
		'駄洒落',
	])('%sはリリース根拠がなくても門田匡陽の作詞作曲とする', (title) => {
		expect(resolveCompositionCredits(title, [])).toEqual({
			composer: ['門田匡陽'],
			lyricist: ['門田匡陽'],
		});
	});

	test.each(['番人ワルツ', '決められたリズム (井上陽水)', 'HOME SICK'])('%sはクレジット未設定のままにする', (title) => {
		expect(resolveCompositionCredits(title, [])).toEqual({
			composer: [],
			lyricist: [],
		});
	});

	test.each([
		['STEP [a・chi-a・chi cover]', ['立花瞳'], ['立花瞳']],
		['Calling You [Jevette Steele cover]', ['Bob Telson'], ['Bob Telson']],
		['薔薇とノンフィクション (PSY・S)', ['松浦雅也'], ['松尾由紀夫']],
		["I Can't Help Falling Love [Elvis Presley cover]", ['Hugo Peretti', 'Luigi Creatore', 'George David Weiss'], ['Hugo Peretti', 'Luigi Creatore', 'George David Weiss']],
		["Hymne à l'amour (Poet-type.M ver.)­ [Edith Piaf cover]", ['Marguerite Monnot'], ['Édith Piaf']],
		["Cocaine Blues [Ramblin' Jack Elliot cover]", ['Troy Junius Arnall'], ['Troy Junius Arnall']],
	] as const)('%sの原作者と表示順を返す', (title, composer, lyricist) => {
		expect(resolveCompositionCredits(title, [])).toEqual({ composer: [...composer], lyricist: [...lyricist] });
	});
});
