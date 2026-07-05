import { describe, expect, test } from 'bun:test';
import { renderSql, type CompositionDraft } from './generate_composition_seed_sql';

const draft = (file: string, sourceFile: string, date: string): CompositionDraft => ({
	file,
	canonicalTitle: '息吹と共に混沌を裂いて',
	status: 'reviewed',
	compositionId: null,
	aliases: [],
	sourceCount: 1,
	releaseCount: 1,
	liveCount: 0,
	sources: [{ type: 'release', project: 'Good Dog Happy Men', file: sourceFile, date }],
});

describe('renderSql', () => {
	test('同じ楽曲を指すreviewed draftの根拠を統合して一度だけクレジットを生成する', () => {
		const sql = renderSql([draft('later.md', '2009-04-02-000000.md', '2009-04-02'), draft('original.md', '2005-06-01-000000.md', '2005-06-01')], ['reviewed']);

		expect(sql.match(/DELETE FROM composition_credit/g)).toHaveLength(1);
		expect(sql.match(/INSERT INTO composition_credit/g)).toHaveLength(5);
		expect(sql).toContain('-- compositions: 1');
		expect(sql).toContain('-- composition_credits: 5');
	});
});
