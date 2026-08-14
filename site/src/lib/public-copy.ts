// パイプラインが埋めた内部メタデータは `key=value` の形で notes / description 系のカラムに入る。
// キーの種類は生成スクリプトごとに増えるため、既知キーを列挙せず、形にマッチさせて落とす。
const INTERNAL_TOKEN = /(?:^|\s)[a-z][a-z0-9_]*=/u;

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
		.filter((line): line is string => line !== undefined)
		.join('\n')
		.trim();
};

/** notes / description / summary / content 系の自由記述カラムかどうか。 */
export const isProseField = (key: string): boolean => /(?:notes?|description|summary|content)$/iu.test(key);
