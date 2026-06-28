const PERSON_ALIAS_ENTRIES: [string, string][] = [
	['maryne', 'Maryne'],
	['門田', '門田匡陽'],
	['masaaki monden', '門田匡陽'],
	['monden masaaki', '門田匡陽'],
	['韮沢', '韮沢雄希'],
	['内田', '内田武瑠'],
	['伊藤', '伊藤大地'],
	['takeru uchida', '内田武瑠'],
	['uchida takeru', '内田武瑠'],
	['daichi ito', '伊藤大地'],
	['daichi itoh', '伊藤大地'],
	['ito daichi', '伊藤大地'],
	['itoh daichi', '伊藤大地'],
	['楢原', '楢原英介'],
	['水野', '水野雅昭'],
	['高野', '高野勲'],
	['金戸', '金戸覚'],
	['takeshi ito', '伊藤武'],
	['takeshi itoh', '伊藤武'],
	['ito takeshi', '伊藤武'],
	['itoh takeshi', '伊藤武'],
	['yuki nirasawa', '韮沢雄希'],
	['nirasawa yuki', '韮沢雄希'],
	['eisuke narahara', '楢原英介'],
	['narahara eisuke', '楢原英介'],
	['masaaki mizuno', '水野雅昭'],
	['mizuno masaaki', '水野雅昭'],
	['白砂', '白砂瞳'],
	['川野', '川野勝広'],
	['相澤', '相澤周平'],
	['原田', '原田勝弘'],
	['森', '森康哲'],
	['吉井', '吉井智広'],
	['小泉', '小泉由香'],
	['岡崎', '岡崎敏之'],
	['池田', '池田洋'],
	['木村', '木村健太郎'],
	['渡辺', '渡辺新二'],
	['柳田', '柳田亮二'],
	['星野', '星野孝文'],
	['上島', '上島慎也'],
	['板橋', '板橋幸'],
	['後藤', '後藤浩之'],
	['本野', '本野信介'],
	['吉田', '吉田和也'],
];

const PERSON_ALIASES = new Map(PERSON_ALIAS_ENTRIES.map(([alias, canonical]) => [normalizePersonAliasKey(alias), canonical]));

export function resolvePersonAlias(name: string): string {
	return PERSON_ALIASES.get(normalizePersonAliasKey(name)) ?? name;
}

export function normalizePersonAliasKey(name: string): string {
	return name
		.normalize('NFKC')
		.replace(/[._-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}
