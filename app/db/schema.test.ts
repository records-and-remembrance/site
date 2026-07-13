import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, test } from 'bun:test';
import { composition, event, person, project, release, venue, work } from './schema';

const columnNames = (table: Parameters<typeof getTableConfig>[0]) => getTableConfig(table).columns.map((column) => column.name);
const uniqueConstraintNames = (table: Parameters<typeof getTableConfig>[0]) => getTableConfig(table).uniqueConstraints.map((constraint) => constraint.name);

describe('公開サイト向けDB拡張', () => {
	test('公開URL対象のエンティティに nullable な slug 列を持つ', () => {
		expect(columnNames(project)).toContain('slug');
		expect(columnNames(person)).toContain('slug');
		expect(columnNames(composition)).toContain('slug');
		expect(columnNames(work)).toContain('slug');
		expect(columnNames(venue)).toContain('slug');
		expect(columnNames(event)).toContain('slug');

		expect(project.slug.notNull).toBe(false);
		expect(person.slug.notNull).toBe(false);
		expect(composition.slug.notNull).toBe(false);
		expect(work.slug.notNull).toBe(false);
		expect(venue.slug.notNull).toBe(false);
		expect(event.slug.notNull).toBe(false);

		expect(uniqueConstraintNames(project)).toContain('project_slug_unique');
		expect(uniqueConstraintNames(person)).toContain('person_slug_unique');
		expect(uniqueConstraintNames(composition)).toContain('composition_slug_unique');
		expect(uniqueConstraintNames(work)).toContain('work_slug_unique');
		expect(uniqueConstraintNames(venue)).toContain('venue_slug_unique');
		expect(uniqueConstraintNames(event)).toContain('event_slug_unique');
	});

	test('release がジャケットURLと表示サイズを保持できる', () => {
		expect(columnNames(release)).toEqual(expect.arrayContaining(['artwork_url', 'artwork_width', 'artwork_height']));
	});

	test('project の scope は monden を既定値とし、monden または external に限定する', () => {
		expect(project.scope.notNull).toBe(true);
		expect(project.scope.hasDefault).toBe(true);
		expect(project.scope.default).toBe('monden');

		const checks = getTableConfig(project).checks.map((check) => check.name);
		expect(checks).toContain('project_scope_check');
	});
});
