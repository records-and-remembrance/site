import { describe, expect, test } from 'bun:test';
import { buildNetworkModel } from './network';

describe('PST-023 network', () => {
	const projects = [
		{ id: 'p1', name: 'A', slug: 'a', scope: 'monden' },
		{ id: 'p2', name: 'B', slug: 'b', scope: 'monden' },
		{ id: 'external', name: 'External', slug: 'external', scope: 'external' },
	];
	const people = [
		{ id: 'person-1', name: 'One', slug: 'one' },
		{ id: 'person-2', name: 'Two', slug: 'two' },
	];

	test('monden scopeのmembershipからノード・エッジを生成し、複数project人物を強調する', () => {
		const model = buildNetworkModel(projects, people, [
			{ id: 'm1', projectId: 'p1', personId: 'person-1', support: false },
			{ id: 'm2', projectId: 'p2', personId: 'person-1', support: true },
			{ id: 'm3', projectId: 'external', personId: 'person-2', support: false },
		]);
		expect(model.edges.map((edge) => `${edge.personId}:${edge.projectId}`)).toEqual(['person-1:p1', 'person-1:p2']);
		expect(model.nodes.find((node) => node.id === 'person-1')?.muted).toBe(false);
	});

	test('supportを除外するとsupport edgeだけが消える', () => {
		const model = buildNetworkModel(
			projects,
			people,
			[
				{ id: 'm1', projectId: 'p1', personId: 'person-1', support: false },
				{ id: 'm2', projectId: 'p2', personId: 'person-1', support: true },
			],
			{ includeSupport: false },
		);
		expect(model.edges).toHaveLength(1);
		expect(model.edges[0]?.support).toBe(false);
	});
});
