import { describe, expect, test } from 'bun:test';
import { editorConfigs, mainResourceOrder, relationDetailColumnKey, relationDetailTarget, resourceConfigs, selectRelationRows } from './resources';

describe('admin screen configuration', () => {
	test('defines every main domain screen', () => {
		expect(mainResourceOrder).toEqual(['people', 'projects', 'works', 'compositions', 'events', 'articles', 'contributions']);

		for (const resource of mainResourceOrder) {
			const config = resourceConfigs[resource];
			expect(config.title).toBeTruthy();
			expect(config.columns.length).toBeGreaterThan(1);
			expect(config.fields.length).toBeGreaterThan(0);
			expect(config.defaultSort).toBeTruthy();
		}
	});

	test('uses human-readable foreign key selectors', () => {
		for (const resource of mainResourceOrder) {
			for (const field of resourceConfigs[resource].fields) {
				if (field.key.endsWith('Id') && field.key !== 'id') {
					expect(['combobox', 'target']).toContain(field.type);
				}
			}
		}
	});

	test('keeps first-milestone relations inside parent details', () => {
		expect(resourceConfigs.people.relations?.map((relation) => relation.resource)).toContain('memberships');
		expect(resourceConfigs.projects.relations?.map((relation) => relation.resource)).toEqual(expect.arrayContaining(['memberships', 'works', 'events']));
		expect(resourceConfigs.works.relations?.map((relation) => relation.resource)).toContain('releases');
		expect(resourceConfigs.works.relations?.find((relation) => relation.resource === 'releases')?.nestedAction?.resource).toBe('label-relations');
		expect(resourceConfigs.works.relations?.find((relation) => relation.resource === 'releases')?.nestedAction?.itemsKey).toBe('labels');
		expect(resourceConfigs.people.relations?.find((relation) => relation.resource === 'memberships')?.nestedAction?.itemsKey).toBe('roles');
		expect(resourceConfigs.events.relations?.map((relation) => relation.resource)).toContain('event-performances');
	});

	test('defines remaining screen detail relationships', () => {
		expect(resourceConfigs.compositions.relations?.map((relation) => relation.resource)).toContain('recordings');
		expect(resourceConfigs.articles.relations?.map((relation) => relation.resource)).toContain('article-mentions');
		expect(resourceConfigs.contributions.fields.map((field) => field.type)).toContain('target');
	});

	test('edits ordered composers and lyricists in separate composition sections', () => {
		const creditRelations = resourceConfigs.compositions.relations?.filter((relation) => relation.resource === 'composition-credits');

		expect(creditRelations).toEqual([
			expect.objectContaining({
				key: 'composers',
				sourceKey: 'credits',
				label: '作曲者',
				parentField: 'compositionId',
				filter: { key: 'creditType', value: 'composer' },
				defaults: { creditType: 'composer' },
				defaultSort: 'orderIndex',
			}),
			expect.objectContaining({
				key: 'lyricists',
				sourceKey: 'credits',
				label: '作詞者',
				parentField: 'compositionId',
				filter: { key: 'creditType', value: 'lyricist' },
				defaults: { creditType: 'lyricist' },
				defaultSort: 'orderIndex',
			}),
		]);
		expect(editorConfigs['composition-credits'].fields).toEqual([
			{ key: 'compositionId', label: '楽曲', type: 'combobox', lookup: 'composition', required: true },
			{ key: 'personId', label: '人物', type: 'combobox', lookup: 'person', required: true },
			expect.objectContaining({ key: 'creditType', type: 'select', required: true }),
			{ key: 'orderIndex', label: '表示順', type: 'number', required: true },
		]);
	});

	test('provides human-readable lookups for every target type', () => {
		expect(['work', 'event', 'person']).toEqual(expect.arrayContaining(['work', 'event', 'person']));
	});

	test('allows membership support status to be edited', () => {
		expect(editorConfigs.memberships.fields).toContainEqual({
			key: 'support',
			label: 'サポート',
			type: 'checkbox',
		});
	});

	test('allows work editorial type to be edited and viewed', () => {
		expect(resourceConfigs.works.fields).toContainEqual({
			key: 'type',
			label: '作品種別',
			type: 'select',
			required: true,
			options: [
				{ value: 'original', label: 'オリジナル' },
				{ value: 'compilation', label: 'コンピレーション（複数アーティスト）' },
				{ value: 'best', label: 'ベスト（同一アーティスト）' },
				{ value: 'live', label: 'ライブ作品集' },
			],
		});
		expect(resourceConfigs.works.columns).toContainEqual({
			key: 'type',
			label: '作品種別',
		});
	});

	test('uses the fixed recording type vocabulary', () => {
		expect(editorConfigs.recordings.fields).toContainEqual({
			key: 'type',
			label: '種別',
			type: 'select',
			required: true,
			options: [
				{ value: 'studio', label: 'スタジオ' },
				{ value: 'live', label: 'ライブ' },
				{ value: 'demo', label: 'デモ' },
				{ value: 'rehearsal', label: 'リハーサル' },
				{ value: 'other', label: 'その他' },
			],
		});
	});

	test('allows recording version details to be edited and viewed', () => {
		expect(editorConfigs.recordings.fields).toEqual(
			expect.arrayContaining([
				{ key: 'versionName', label: 'バージョン名', type: 'text', span: 2 },
				{ key: 'versionDescription', label: 'バージョンの特徴', type: 'textarea', span: 2 },
			]),
		);
		expect(resourceConfigs.compositions.relations?.find((relation) => relation.resource === 'recordings')?.columns).toEqual(
			expect.arrayContaining([
				{ key: 'versionName', label: 'バージョン名' },
				{ key: 'versionDescription', label: 'バージョンの特徴', kind: 'muted' },
			]),
		);
	});

	test('allows release edition lineage to be edited', () => {
		expect(editorConfigs.releases.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: 'editionType', type: 'select', required: true }),
				expect.objectContaining({ key: 'reissueOfReleaseId', type: 'combobox', lookup: 'release' }),
			]),
		);
	});

	test('shows the selected release track list in release details', () => {
		expect(editorConfigs.releases.relations).toContainEqual(
			expect.objectContaining({
				key: 'tracks',
				label: 'トラックリスト',
				resource: 'tracks',
				parentField: 'releaseId',
				defaultSort: 'trackNumber',
				defaultDirection: 'asc',
				detailTarget: {
					resource: 'compositions',
					idKey: 'compositionId',
					columnKey: 'compositionTitle',
				},
			}),
		);
	});

	test('allows artists to be attached to multi-artist works', () => {
		expect(resourceConfigs.works.relations).toContainEqual(
			expect.objectContaining({
				key: 'projects',
				resource: 'work-projects',
				parentField: 'workId',
			}),
		);
		expect(editorConfigs['work-projects'].fields).toEqual(
			expect.arrayContaining([expect.objectContaining({ key: 'projectId', lookup: 'project' }), expect.objectContaining({ key: 'relationType', type: 'select' })]),
		);
	});

	test('splits project memberships into regular and support sections', () => {
		const membershipRelations = resourceConfigs.projects.relations?.filter((relation) => relation.resource === 'memberships');

		expect(membershipRelations).toEqual([
			expect.objectContaining({
				key: 'members',
				label: 'メンバー',
				filter: { key: 'support', value: false },
				defaults: { support: false },
			}),
			expect.objectContaining({
				key: 'supportMembers',
				sourceKey: 'members',
				label: 'サポートメンバー',
				filter: { key: 'support', value: true },
				defaults: { support: true },
			}),
		]);
	});

	test('selects relation rows by source and support status', () => {
		const related = {
			members: [
				{ id: 'regular', personName: '通常奏者', support: false },
				{ id: 'support-z', personName: '山田', support: true },
				{ id: 'support-a', personName: '阿部', support: true },
			],
		};
		const supportRelation = resourceConfigs.projects.relations?.find((relation) => relation.key === 'supportMembers');

		expect(selectRelationRows(related, supportRelation!)).toEqual([
			{ id: 'support-a', personName: '阿部', support: true },
			{ id: 'support-z', personName: '山田', support: true },
		]);
	});

	test('defines initial sorting for every related table', () => {
		for (const config of Object.values(resourceConfigs)) {
			for (const relation of config.relations ?? []) {
				expect(relation.defaultSort).toBeTruthy();
				expect(relation.columns.map((column) => column.key)).toContain(relation.defaultSort);
			}
		}
	});

	test('resolves a configured resource field to its detail resource', () => {
		const worksRelation = resourceConfigs.projects.relations?.find((relation) => relation.key === 'works');
		const tracksRelation = resourceConfigs.works.relations?.find((relation) => relation.key === 'tracks');

		expect(relationDetailTarget(worksRelation!, { id: 'work-1' })).toEqual({
			resource: 'works',
			id: 'work-1',
		});
		expect(
			relationDetailTarget(tracksRelation!, {
				id: 'track-1',
				compositionId: 'composition-1',
			}),
		).toEqual({
			resource: 'compositions',
			id: 'composition-1',
		});
		expect(relationDetailColumnKey(tracksRelation!)).toBe('compositionTitle');
		expect(relationDetailTarget(tracksRelation!, { id: 'track-1' })).toBeNull();
		expect(relationDetailTarget(worksRelation!, {})).toBeNull();
	});

	test('links relation resources instead of membership and performance records', () => {
		const projectMembership = resourceConfigs.people.relations?.find((relation) => relation.key === 'memberships');
		const personMembership = resourceConfigs.projects.relations?.find((relation) => relation.key === 'members');
		const performance = resourceConfigs.events.relations?.find((relation) => relation.key === 'performances');

		expect(projectMembership?.detailTarget).toEqual({
			resource: 'projects',
			idKey: 'projectId',
			columnKey: 'projectName',
		});
		expect(personMembership?.detailTarget).toEqual({
			resource: 'people',
			idKey: 'personId',
			columnKey: 'personName',
		});
		expect(performance?.detailTarget).toEqual({
			resource: 'compositions',
			idKey: 'compositionId',
			columnKey: 'compositionTitle',
		});
	});
});
