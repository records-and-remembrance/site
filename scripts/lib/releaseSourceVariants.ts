export type ReleaseSourceVariant = {
	key: string | null;
	title: string | null;
	trackSection: string | null;
	distributionMethod: string | null;
};

type ReleaseSource = {
	name: string;
};

const SPLIT_RELEASES: Record<string, Array<Omit<ReleaseSourceVariant, 'trackSection'>>> = {
	'2013-10-02-000000_1.md': [
		{
			key: 'The Night2',
			title: 'The Night2',
			distributionMethod: 'DISKUNION店頭 (購入者特典)',
		},
		{
			key: 'The Lunch2',
			title: 'The Lunch2',
			distributionMethod: 'TOWER RECORDS店頭 (購入者特典)',
		},
	],
};

function splitLevelThreeSections(section: string): Map<string, string> {
	const sections = new Map<string, string[]>();
	let current: string | null = null;

	for (const line of section.split(/\r?\n/)) {
		const heading = line.trim().match(/^###\s+(.+)$/);
		if (heading) {
			current = heading[1]!.trim();
			sections.set(current, []);
			continue;
		}
		if (current) sections.get(current)!.push(line);
	}

	return new Map([...sections].map(([title, lines]) => [title, lines.join('\n').trim()]));
}

export function releaseSourceVariants(source: ReleaseSource, trackSection: string | undefined): ReleaseSourceVariant[] {
	const definitions = SPLIT_RELEASES[source.name];
	if (!definitions) {
		return [
			{
				key: null,
				title: null,
				trackSection: trackSection ?? null,
				distributionMethod: null,
			},
		];
	}

	const sections = splitLevelThreeSections(trackSection ?? '');
	return definitions.map((definition) => {
		const variantSection = sections.get(definition.key!);
		if (!variantSection) {
			throw new Error(`Could not find track section "${definition.key}" in ${source.name}`);
		}
		return { ...definition, trackSection: variantSection };
	});
}

export function releaseIdentity(sourceName: string, variantKey: string | null): string {
	return variantKey ? `${sourceName}:${variantKey}` : sourceName;
}
