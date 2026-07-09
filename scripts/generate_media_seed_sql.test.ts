import { describe, expect, test } from 'bun:test';
import { parseApprovedArticleCandidates, renderSql, type SourceArticle } from './generate_media_seed_sql';

const mediaSource: SourceArticle = {
	path: 'rawData/articles_by_category/media/2016-01-13-042932.md',
	name: '2016-01-13-042932.md',
	title: 'Web掲載',
	date: '2016-01-13',
	tags: ['Media'],
	body: '- [original index](https://example.com/index)',
};

describe('generate_media_seed_sql article candidates', () => {
	test('parses only approved rows from a review TSV', () => {
		const rows = parseApprovedArticleCandidates(
			[
				'# comment',
				[
					'review_status',
					'source_file',
					'source_heading',
					'source_group',
					'publication_name',
					'publication_type',
					'article_title',
					'article_type',
					'published_date',
					'date_precision',
					'url',
					'mention_project',
					'mention_kind',
					'summary',
					'notes',
				].join('\t'),
				[
					'approved',
					'rawData/articles/source.md',
					'BURGER NUDS',
					'2014.6.21',
					'RO69',
					'web',
					"Live report's title",
					'live_report',
					'2014-06-21',
					'day',
					'https://example.com/live',
					'BURGER NUDS',
					'event',
					'2014.6.21',
					'approved note',
				].join('\t'),
				[
					'pending',
					'rawData/articles/source.md',
					'BURGER NUDS',
					'',
					'Rooftop',
					'web',
					'Pending title',
					'web_article',
					'',
					'',
					'https://example.com/pending',
					'BURGER NUDS',
					'project_or_person',
					'',
					'',
				].join('\t'),
			].join('\n'),
			'rawData/article_candidates/source.tsv',
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			publicationName: 'RO69',
			articleTitle: "Live report's title",
			articleType: 'live_report',
			publishedDate: '2014-06-21',
			url: 'https://example.com/live',
		});
		expect(rows[0]!.notes).toContain('candidate_file=rawData/article_candidates/source.tsv');
	});

	test('renders approved article candidates as individual article rows', () => {
		const candidate = parseApprovedArticleCandidates(
			[
				'review_status\tsource_file\tsource_heading\tsource_group\tpublication_name\tpublication_type\tarticle_title\tarticle_type\tpublished_date\tdate_precision\turl\tmention_project\tmention_kind\tsummary\tnotes',
				"approved\trawData/articles/source.md\tBURGER NUDS\t2014.6.21\tRO69\tweb\tLive report's title\tlive_report\t2014-06-21\tday\thttps://example.com/live\tBURGER NUDS\tevent\t2014.6.21\tapproved note",
			].join('\n'),
			'rawData/article_candidates/source.tsv',
		);

		const sql = renderSql([mediaSource], candidate);

		expect(sql).toContain('-- approved_article_candidates: 1');
		expect(sql).toContain("Live report''s title");
		expect(sql).toContain('https://example.com/live');
		expect(sql).toContain('candidate_file=rawData/article_candidates/source.tsv');
		expect(sql).toContain('source_heading=BURGER NUDS');
		expect(sql.match(/INSERT INTO article /g)).toHaveLength(2);
	});
});
