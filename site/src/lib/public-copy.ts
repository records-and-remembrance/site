const INTERNAL_KEYS = '(?:source_file|source_tags|draft_file|source_count|release_count|live_count|aliases|candidate_file|source|source_heading|mention_project|mention_kind|candidate_notes)';
const INTERNAL_TOKEN = new RegExp(`(?:^|\\s)${INTERNAL_KEYS}=`, 'u');

export const sanitizePublicText = (value: unknown): string => {
	if (typeof value !== 'string') return '';
	return value
		.split(/\r?\n/u)
		.map((line): string | undefined => {
			const match = line.match(INTERNAL_TOKEN);
			if (match?.index !== undefined) {
				const prefix = line.slice(0, match.index).trimEnd();
				return prefix || undefined;
			}
			return line.trimEnd();
		})
		.filter((line): line is string => line !== undefined && (!line.trim() || !INTERNAL_TOKEN.test(line.trim())))
		.join('\n')
		.trim();
};
