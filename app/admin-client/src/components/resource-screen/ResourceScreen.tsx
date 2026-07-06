import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from 'react-aria-components';
import { getRecord } from '../../api';
import { resourceConfigs, type DetailTarget, type EditorResource, type MainResource } from '../../resources';
import { EditorDialog } from '../editor-dialog/EditorDialog';
import { ResourceDetailPanel, type ResourceEditorState } from './ResourceDetailPanel';
import { ResourceTable } from './ResourceTable';

export function ResourceScreen({
	resource,
	detailTarget,
	onOpenDetail,
	onCloseDetail,
}: {
	resource: MainResource;
	detailTarget?: DetailTarget | undefined;
	onOpenDetail: (target: DetailTarget) => void;
	onCloseDetail: () => void;
}) {
	const config = resourceConfigs[resource];
	const queryClient = useQueryClient();
	const [editor, setEditor] = useState<ResourceEditorState>();
	const selectedId = detailTarget?.resource === resource ? detailTarget.id : undefined;
	const detailQuery = useQuery({
		queryKey: ['admin', 'detail', detailTarget?.resource, detailTarget?.id],
		queryFn: () => getRecord(detailTarget?.resource as EditorResource, detailTarget?.id as string),
		enabled: Boolean(detailTarget),
	});

	const handleSaved = async (saved: Record<string, unknown>) => {
		setEditor(undefined);
		await queryClient.invalidateQueries({ queryKey: ['admin'] });
		if (editor?.resource === resource && saved.id) {
			onOpenDetail({ resource, id: String(saved.id) });
		}
	};

	const handleDeleted = async () => {
		setEditor(undefined);
		await queryClient.invalidateQueries({ queryKey: ['admin'] });
	};

	const openRelatedEditor = async (state: ResourceEditorState) => {
		if (state.record?.id) {
			const completeRecord = await getRecord(state.resource, String(state.record.id));
			setEditor({ ...state, record: completeRecord });
			return;
		}
		setEditor(state);
	};

	return (
		<div className="resource-page">
			<header className="page-header">
				<div>
					<p className="eyebrow">Monden Database</p>
					<h1>{config.title}</h1>
					<p>{config.description}</p>
				</div>
				<Button className="button primary" onPress={() => setEditor({ resource })}>
					<Plus size={18} />
					{config.singular}を追加
				</Button>
			</header>

			<ResourceTable resource={resource} selectedId={selectedId} onOpenDetail={onOpenDetail} />

			{detailTarget ? (
				<ResourceDetailPanel
					resource={detailTarget.resource}
					record={detailQuery.data}
					isLoading={detailQuery.isLoading}
					onClose={onCloseDetail}
					onEdit={(record) => setEditor({ resource: detailTarget.resource, record })}
					onEditRelated={openRelatedEditor}
					onOpenDetail={onOpenDetail}
				/>
			) : null}

			{editor ? (
				<EditorDialog resource={editor.resource} record={editor.record} defaults={editor.defaults} onClose={() => setEditor(undefined)} onSaved={handleSaved} onDeleted={handleDeleted} />
			) : null}
		</div>
	);
}
