const PERSON_ALIAS_ENTRIES: [string, string][] = [
  ["maryne", "Maryne"],
  ["masaaki monden", "門田匡陽"],
  ["monden masaaki", "門田匡陽"],
  ["takeru uchida", "内田武瑠"],
  ["uchida takeru", "内田武瑠"],
  ["daichi ito", "伊藤大地"],
  ["daichi itoh", "伊藤大地"],
  ["ito daichi", "伊藤大地"],
  ["itoh daichi", "伊藤大地"],
  ["takeshi ito", "伊藤武"],
  ["takeshi itoh", "伊藤武"],
  ["ito takeshi", "伊藤武"],
  ["itoh takeshi", "伊藤武"],
  ["yuki nirasawa", "韮沢雄希"],
  ["nirasawa yuki", "韮沢雄希"],
  ["eisuke narahara", "楢原英介"],
  ["narahara eisuke", "楢原英介"],
  ["masaaki mizuno", "水野雅昭"],
  ["mizuno masaaki", "水野雅昭"],
];

const PERSON_ALIASES = new Map(PERSON_ALIAS_ENTRIES.map(([alias, canonical]) => [normalizePersonAliasKey(alias), canonical]));

export function resolvePersonAlias(name: string): string {
  return PERSON_ALIASES.get(normalizePersonAliasKey(name)) ?? name;
}

export function normalizePersonAliasKey(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
