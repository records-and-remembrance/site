import { describe, expect, test } from 'bun:test';
import { buildExternalNetworkModel } from './network-external';

describe('PST-024 external network scope', () => {
	const projects = [
		{ id: 'monden-project', name: '門田プロジェクト', slug: 'monden-project', scope: 'monden' },
		{ id: 'external-project', name: '外部バンド', slug: 'external-band', scope: 'external' },
		{ id: 'unrelated-project', name: '未接続の外部バンド', slug: 'unrelated-band', scope: 'external' },
	];
	const people = [
		{ id: 'person-1', name: '門田匡陽', slug: 'masaaki-monden' },
		{ id: 'person-2', name: '外部メンバー', slug: 'external-member' },
	];
	const memberships = [
		{ id: 'monden-membership', projectId: 'monden-project', personId: 'person-1', support: false },
		{ id: 'external-membership-1', projectId: 'external-project', personId: 'person-1', support: false },
		{ id: 'external-membership-2', projectId: 'external-project', personId: 'person-2', support: false },
		{ id: 'unrelated-membership', projectId: 'unrelated-project', personId: 'person-2', support: false },
	];

	test('mondenに在籍する人物から直接つながるexternalだけをdepth 1として返す', () => {
		const model = buildExternalNetworkModel(projects, people, memberships);

		expect([...model.projectsByPerson.keys()]).toEqual(['person-1']);
		expect(model.projectsByPerson.get('person-1')).toEqual([
			expect.objectContaining({
				id: 'external-project',
				label: '外部バンド',
				href: '/projects/external-band',
				muted: true,
			}),
		]);
		expect(model.projectsByPerson.get('person-2')).toBeUndefined();
	});

	test('external projectのmembershipはdepth 2として一度だけ返し、slug規約違反はリンクにしない', () => {
		const model = buildExternalNetworkModel(
			projects.map((project) => (project.id === 'external-project' ? { ...project, slug: 'External Band' } : project)),
			people,
			memberships,
		);

		expect(model.projectsByPerson.get('person-1')?.[0]).toMatchObject({ href: undefined });
		expect(model.membershipsByProject.get('external-project')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ personId: 'person-1', personHref: '/people/masaaki-monden' }),
				expect.objectContaining({ personId: 'person-2', personHref: '/people/external-member' }),
			]),
		);
	});

	test('同一人物の重複membershipでexternal projectを重複表示しない', () => {
		const model = buildExternalNetworkModel(projects, people, [...memberships, { ...memberships[1], id: 'duplicate-membership' }]);

		expect(model.projectsByPerson.get('person-1')).toHaveLength(1);
		expect(model.membershipsByProject.get('external-project')).toHaveLength(3);
	});
});
