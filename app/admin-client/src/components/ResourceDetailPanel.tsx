import { LoaderCircle, Pencil, Plus, X } from 'lucide-react';
import { Button } from 'react-aria-components';
import { editorConfigs, relationDetailColumnKey, relationDetailTarget, selectRelationRows, type DetailTarget, type EditorResource, type RelationConfig } from '../resources';
import { CellValue, EmptyState, formatValue, primaryLabel, resolvedDisplayValue } from './ResourceDisplay';

export interface ResourceEditorState {
	resource: EditorResource;
	record?: Record<string, unknown> | undefined;
	defaults?: Record<string, string | boolean> | undefined;
}

export function ResourceDetailPanel({
	resource,
	record,
	isLoading,
	onClose,
	onEdit,
	onEditRelated,
	onOpenDetail,
}: {
	resource: EditorResource;
	record?: Record<string, unknown> | undefined;
	isLoading: boolean;
	onClose: () => void;
	onEdit: (record: Record<string, unknown>) => void;
	onEditRelated: (state: ResourceEditorState) => void;
	onOpenDetail: (target: DetailTarget) => void;
}) {
	const config = editorConfigs[resource];
	const related = (record?.related ?? {}) as Record<string, Array<Record<string, unknown>>>;

	return (
		<aside className="detail-panel">
			<header className="detail-header">
				<div>
					<p className="eyebrow">Record detail</p>
					<h2>{record ? primaryLabel(record) : '読み込み中'}</h2>
				</div>
				<Button aria-label="詳細を閉じる" className="icon-button" onPress={onClose}>
					<X size={20} />
				</Button>
			</header>

			{isLoading || !record ? (
				<EmptyState icon={<LoaderCircle className="spin" />} text="詳細を読み込み中" />
			) : (
				<div className="detail-body">
					<div className="detail-actions">
						<Button className="button secondary" onPress={() => onEdit(record)}>
							<Pencil size={17} />
							編集
						</Button>
					</div>
					<dl className="detail-fields">
						{config.fields
							.filter((field) => field.type !== 'target')
							.map((field) => (
								<div key={field.key} className={field.span === 2 ? 'span-2' : ''}>
									<dt>{field.label}</dt>
									<dd>{formatValue(resolvedDisplayValue(record, field.key), field.type === 'checkbox' ? 'boolean' : undefined)}</dd>
								</div>
							))}
					</dl>

					{(config.relations ?? []).map((relation) => (
						<RelationSection key={relation.key} relation={relation} rows={selectRelationRows(related, relation)} parentId={String(record.id)} onEdit={onEditRelated} onOpenDetail={onOpenDetail} />
					))}
				</div>
			)}
		</aside>
	);
}

function RelationSection({
	relation,
	rows,
	parentId,
	onEdit,
	onOpenDetail,
}: {
	relation: RelationConfig;
	rows: Array<Record<string, unknown>>;
	parentId: string;
	onEdit: (state: ResourceEditorState) => void;
	onOpenDetail: (target: DetailTarget) => void;
}) {
	const canAdd = relation.resource && !relation.readonly;
	return (
		<section className="relation-section">
			<header>
				<div>
					<h3>{relation.label}</h3>
					<span>{rows.length}</span>
				</div>
				{canAdd ? (
					<Button
						className="text-button"
						onPress={() =>
							onEdit({
								resource: relation.resource as EditorResource,
								defaults: {
									...relation.defaults,
									...(relation.parentField ? { [relation.parentField]: parentId } : {}),
								},
							})
						}
					>
						<Plus size={15} />
						追加
					</Button>
				) : null}
			</header>
			{rows.length === 0 ? (
				<p className="empty-relation">関連レコードはありません</p>
			) : (
				<div className="relation-table-wrap">
					<table className="relation-table">
						<thead>
							<tr>
								{relation.columns.map((column) => (
									<th key={column.key}>{column.label}</th>
								))}
								{relation.resource && !relation.readonly ? <th aria-label="操作" /> : null}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, index) => (
								<tr key={String(row.id ?? index)}>
									{relation.columns.map((column) => {
										const target = column.key === relationDetailColumnKey(relation) ? relationDetailTarget(relation, row) : null;
										return (
											<td key={column.key}>
												{target ? (
													<Button className="relation-primary-link" onPress={() => onOpenDetail(target)}>
														<CellValue value={row[column.key]} column={column} />
													</Button>
												) : (
													<CellValue value={row[column.key]} column={column} />
												)}
											</td>
										);
									})}
									{relation.resource && !relation.readonly ? (
										<td className="relation-actions">
											<Button
												aria-label={`${relation.label}を編集`}
												className="mini-button"
												onPress={() =>
													onEdit({
														resource: relation.resource as EditorResource,
														record: row,
														defaults: relation.parentField ? { [relation.parentField]: parentId } : undefined,
													})
												}
											>
												<Pencil size={14} />
											</Button>
											<NestedActions relation={relation} row={row} onEdit={onEdit} />
										</td>
									) : null}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}

function NestedActions({ relation, row, onEdit }: { relation: RelationConfig; row: Record<string, unknown>; onEdit: (state: ResourceEditorState) => void }) {
	const action = relation.nestedAction;
	if (!action) return null;
	const defaults = { [action.parentField]: String(row.id) };

	return (
		<>
			{nestedRows(row, relation).map((nested) => (
				<Button
					key={String(nested.id)}
					className="mini-button labeled nested-edit"
					onPress={() =>
						onEdit({
							resource: action.resource,
							record: nested,
							defaults,
						})
					}
				>
					<Pencil size={12} />
					{nestedLabel(nested)}
				</Button>
			))}
			<Button
				className="mini-button labeled"
				onPress={() =>
					onEdit({
						resource: action.resource,
						defaults,
					})
				}
			>
				<Plus size={13} />
				{action.label}
			</Button>
		</>
	);
}

function nestedRows(row: Record<string, unknown>, relation: RelationConfig): Array<Record<string, unknown>> {
	const value = relation.nestedAction ? row[relation.nestedAction.itemsKey] : undefined;
	return Array.isArray(value) ? value : [];
}

function nestedLabel(record: Record<string, unknown>): string {
	return String(record.name ?? record.roleName ?? record.instrumentName ?? '編集');
}
