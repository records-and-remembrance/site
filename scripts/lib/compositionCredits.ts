export type CompositionCreditSource = {
	type: 'release' | 'live';
	project: string | null;
	file: string;
	date: string | null;
};

export type ResolvedCompositionCredits = {
	composer: string[];
	lyricist: string[];
};

export const SUPPLEMENTAL_COMPOSITION_CREDIT_PEOPLE = [
	{ name: 'Richard Rodgers', sourceFile: '2012-04-14-000001.md' },
	{ name: 'Lorenz Hart', sourceFile: '2012-04-14-000001.md' },
	{ name: '立花瞳', sourceFile: '2016-01-20-033504.md' },
	{ name: 'Bob Telson', sourceFile: '2016-01-20-033504.md' },
	{ name: '松浦雅也', sourceFile: '2016-01-20-033504.md' },
	{ name: '松尾由紀夫', sourceFile: '2016-01-20-033504.md' },
	{ name: 'Hugo Peretti', sourceFile: '2016-01-20-033504.md' },
	{ name: 'Luigi Creatore', sourceFile: '2016-01-20-033504.md' },
	{ name: 'George David Weiss', sourceFile: '2016-01-20-033504.md' },
	{ name: 'Marguerite Monnot', sourceFile: '2016-01-20-033504.md' },
	{ name: 'Édith Piaf', sourceFile: '2016-01-20-033504.md' },
	{ name: 'Troy Junius Arnall', sourceFile: '2016-01-20-033504.md' },
] as const;

const MONDEN = '門田匡陽';
const MONDEN_CREDIT_TITLES = new Set([
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
]);
const BURGER_NUDS_MEMBERS = [MONDEN, '丸山潤', '内田武瑠'];
const EARLY_GDHM_MEMBERS = [MONDEN, '韮沢雄希', '内田武瑠', '伊藤大地'];
const BURGER_NUDS_SOLO_CREDIT_FILES = new Set(['1999-06-01-000000.md', '1999-08-01-000000.md', '1999-09-01-000000.md']);
const COVER_CREDITS = [
	{ title: 'Blue Moon', composer: ['Richard Rodgers'], lyricist: ['Lorenz Hart'] },
	{ title: 'STEP [', composer: ['立花瞳'], lyricist: ['立花瞳'] },
	{ title: 'Calling You [', composer: ['Bob Telson'], lyricist: ['Bob Telson'] },
	{ title: '薔薇とノンフィクション', composer: ['松浦雅也'], lyricist: ['松尾由紀夫'] },
	{
		title: "I Can't Help Falling Love [",
		composer: ['Hugo Peretti', 'Luigi Creatore', 'George David Weiss'],
		lyricist: ['Hugo Peretti', 'Luigi Creatore', 'George David Weiss'],
	},
	{ title: "Hymne à l'amour (Poet-type.M ver.)", composer: ['Marguerite Monnot'], lyricist: ['Édith Piaf'] },
	{ title: 'Cocaine Blues [', composer: ['Troy Junius Arnall'], lyricist: ['Troy Junius Arnall'] },
] as const;

function isCreditProject(project: string | null): boolean {
	return project === 'BURGER NUDS' || project === 'Good Dog Happy Men' || project === 'Poet-type.M' || Boolean(project?.startsWith('門田匡陽 (ソロ名義/'));
}

function earliestRelease(sources: CompositionCreditSource[]): CompositionCreditSource | null {
	return (
		sources
			.filter((source) => source.type === 'release' && isCreditProject(source.project))
			.sort((a, b) => `${a.date ?? '9999-99-99'}:${a.file}`.localeCompare(`${b.date ?? '9999-99-99'}:${b.file}`))[0] ?? null
	);
}

export function resolveCompositionCredits(title: string, sources: CompositionCreditSource[]): ResolvedCompositionCredits {
	if (title === 'UNKNOWN' || MONDEN_CREDIT_TITLES.has(title)) return { composer: [MONDEN], lyricist: [MONDEN] };
	const cover = COVER_CREDITS.find((credit) => title.startsWith(credit.title));
	if (cover) return { composer: [...cover.composer], lyricist: [...cover.lyricist] };

	const source = earliestRelease(sources);
	if (!source) return { composer: [], lyricist: [] };

	if (source.project === 'BURGER NUDS') {
		if (BURGER_NUDS_SOLO_CREDIT_FILES.has(source.file)) {
			return { composer: [MONDEN], lyricist: [MONDEN] };
		}
		return {
			composer: [...BURGER_NUDS_MEMBERS],
			lyricist: title === 'ANALYZE' ? [...BURGER_NUDS_MEMBERS] : title === '無限交響楽' ? [MONDEN, '内田武瑠'] : [MONDEN],
		};
	}

	if (source.project === 'Good Dog Happy Men') {
		const earlyBandCredit = (source.date ?? '9999-99-99') <= '2005-06-01';
		return {
			composer: earlyBandCredit ? [...EARLY_GDHM_MEMBERS] : [MONDEN],
			lyricist: [MONDEN],
		};
	}

	if (source.project === 'Poet-type.M' || source.project?.startsWith('門田匡陽 (ソロ名義/')) {
		return { composer: [MONDEN], lyricist: [MONDEN] };
	}

	return { composer: [], lyricist: [] };
}
