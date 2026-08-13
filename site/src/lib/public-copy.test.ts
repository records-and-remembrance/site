import { describe, expect, test } from 'bun:test';
import { sanitizePublicText } from './public-copy';

describe('公開文面のメタデータ除去', () => {
	test('内部キーを含む行を公開文面から除去し、前置きの説明は残す', () => {
		expect(sanitizePublicText('ライブレポート。\ncandidate_file=notes.md source_file=seed.md\nsource_count=0')).toBe('ライブレポート。');
		expect(sanitizePublicText('媒体紹介 candidate_file=article.md')).toBe('媒体紹介');
	});

	test('通常の改行と空白は保持する', () => {
		expect(sanitizePublicText('第一段落\n\n第二段落')).toBe('第一段落\n\n第二段落');
	});
});
