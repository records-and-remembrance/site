import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Pencil, Plus, Settings2, X } from 'lucide-react';
import { useState } from 'react';
import { Button, Dialog, Modal, ModalOverlay, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { listRecords } from '../../api';
import { editorConfigs, masterResources, type EditorResource } from '../../resources';
import { EditorDialog } from '../editor-dialog/EditorDialog';
import { useCloseOnEscape } from '../overlay/escape-dismissal';

export function MasterManager({ onClose }: { onClose: () => void }) {
	useCloseOnEscape(onClose);
	const queryClient = useQueryClient();
	const [resource, setResource] = useState<EditorResource>(masterResources[0]!.resource);
	const [editorRecord, setEditorRecord] = useState<Record<string, unknown> | null>();
	const config = editorConfigs[resource];
	const query = useQuery({
		queryKey: ['admin', 'masters', resource],
		queryFn: () =>
			listRecords(resource, {
				search: '',
				page: 1,
				pageSize: 100,
				sort: config.defaultSort,
				direction: 'asc',
			}),
	});

	return (
		<>
			<ModalOverlay isOpen isDismissable isKeyboardDismissDisabled className="modal-overlay" onOpenChange={onClose}>
				<Modal className="master-modal">
					<Dialog aria-label="マスタデータ管理" className="dialog master-dialog">
						<header className="dialog-header">
							<div>
								<p className="eyebrow">Compact management</p>
								<h2>マスタデータ</h2>
							</div>
							<Button aria-label="閉じる" className="icon-button" onPress={onClose}>
								<X size={20} />
							</Button>
						</header>
						<Tabs selectedKey={resource} orientation="vertical" className="master-tabs" onSelectionChange={(key) => setResource(String(key) as EditorResource)}>
							<TabList aria-label="マスタ種別">
								{masterResources.map((item) => (
									<Tab id={item.resource} key={item.resource}>
										<Settings2 size={15} />
										{item.label}
									</Tab>
								))}
							</TabList>
							<TabPanel id={resource} className="master-panel">
								<header>
									<div>
										<h3>{config.title}</h3>
										<p>{query.data?.meta.total ?? 0} records</p>
									</div>
									<Button className="button primary small" onPress={() => setEditorRecord(null)}>
										<Plus size={16} />
										追加
									</Button>
								</header>
								{query.isLoading ? (
									<div className="empty-state">
										<LoaderCircle className="spin" />
										読み込み中
									</div>
								) : (
									<div className="master-list">
										{(query.data?.data ?? []).map((record) => (
											<button type="button" key={String(record.id)} onClick={() => setEditorRecord(record)}>
												<span>
													<strong>{masterLabel(record)}</strong>
													<small>{masterDescription(record)}</small>
												</span>
												<Pencil size={15} />
											</button>
										))}
									</div>
								)}
							</TabPanel>
						</Tabs>
					</Dialog>
				</Modal>
			</ModalOverlay>

			{editorRecord !== undefined ? (
				<EditorDialog
					resource={resource}
					record={editorRecord ?? undefined}
					onClose={() => setEditorRecord(undefined)}
					onSaved={async () => {
						setEditorRecord(undefined);
						await queryClient.invalidateQueries({ queryKey: ['admin'] });
					}}
				/>
			) : null}
		</>
	);
}

function masterLabel(record: Record<string, unknown>): string {
	return String(record.name ?? record.publicationName ?? record.issueNumber ?? record.id);
}

function masterDescription(record: Record<string, unknown>): string {
	return String(record.location ?? record.category ?? record.publisher ?? record.publishedDate ?? record.description ?? '');
}
