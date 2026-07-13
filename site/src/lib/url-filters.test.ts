import { describe, expect, test } from 'bun:test';
import { matchesFilterValues, normalizeFilterUrl, parseFilterQuery, serializeFilterQuery, serializeFilterUrl } from './url-filters';

const schema = {
	project: ['alpha', 'beta'],
	format: ['cd', 'digital'],
	decade: ['1980s', '1990s'],
} as const;

describe('PST-018 URL filter adapter', () => {
	test('不正値・空値・重複を除き、複数値を辞書順で復元する', () => {
		expect(parseFilterQuery('?project=beta&project=alpha&project=beta&format=&unknown=x&decade=2050s', schema)).toEqual({
			project: ['alpha', 'beta'],
			format: [],
			decade: [],
		});
	});

	test('query keyとvalueを安定した順序で直列化する', () => {
		expect(serializeFilterQuery({ project: ['beta', 'alpha', 'alpha'], format: ['digital'] }, schema)).toBe('format=digital&project=alpha&project=beta');
	});

	test('正規化してもpathとhashを保持する', () => {
		expect(normalizeFilterUrl('/discography?project=beta&unknown=x&project=alpha#edition-a', schema)).toBe('/discography?project=alpha&project=beta#edition-a');
		expect(serializeFilterUrl('/lives#year-2020', { project: ['alpha'] }, schema)).toBe('/lives?project=alpha#year-2020');
	});

	test('一覧項目は選択された値のいずれかに一致する', () => {
		expect(matchesFilterValues({ project: ['alpha'], format: ['cd'] }, { project: ['alpha', 'beta'], format: [] })).toBe(true);
		expect(matchesFilterValues({ project: ['beta'], format: ['cd'] }, { project: ['alpha'], format: ['digital'] })).toBe(false);
	});
});
