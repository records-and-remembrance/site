import { describe, expect, test } from 'bun:test';
import { isProseField, sanitizePublicText } from './public-copy';

describe('公開文面のメタデータ除去', () => {
	test('内部キーを含む行を公開文面から除去し、前置きの説明は残す', () => {
		expect(sanitizePublicText('ライブレポート。\ncandidate_file=notes.md source_file=seed.md\nsource_count=0')).toBe('ライブレポート。');
		expect(sanitizePublicText('媒体紹介 candidate_file=article.md')).toBe('媒体紹介');
	});

	test('既知キーの列挙に頼らず、key=value の形をした行を落とす', () => {
		// 実データに現れるが旧実装が取りこぼしていたキー。
		expect(sanitizePublicText('source_file=2003-12-07-000000.md\nsection=セットリスト')).toBe('');
		expect(sanitizePublicText('article_diagnostics=missing_content\nraw_content=…\npage_references=12-13')).toBe('');
		expect(sanitizePublicText('review_status=pending\nwork_candidates=a|b\nsubject=特集')).toBe('');
		expect(sanitizePublicText('解説文。\nunknown_future_key=whatever')).toBe('解説文。');
	});

	test('通常の改行と空白は保持する', () => {
		expect(sanitizePublicText('第一段落\n\n第二段落')).toBe('第一段落\n\n第二段落');
	});

	test('文字列以外は空文字にする', () => {
		expect(sanitizePublicText(null)).toBe('');
		expect(sanitizePublicText(undefined)).toBe('');
		expect(sanitizePublicText(42)).toBe('');
	});

	test('自由記述カラムだけをprose fieldと判定する', () => {
		for (const key of ['notes', 'note', 'description', 'versionDescription', 'summary', 'content', 'variationNote']) expect(isProseField(key)).toBe(true);
		for (const key of ['id', 'slug', 'name', 'title', 'url', 'eventDate', 'catalogNumber']) expect(isProseField(key)).toBe(false);
	});
});
