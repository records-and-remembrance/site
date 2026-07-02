import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, GitMerge, LoaderCircle, Pencil, Scissors, Search, X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Button, Cell, Checkbox, Column, Dialog, Heading, Input, Modal, ModalOverlay, Row, SearchField, Table, TableBody, TableHeader, type Selection } from 'react-aria-components';
import type { RecordingType } from '../../recording/types';
import type { RecordingGroup, RecordingMetadata, RecordingOrganizerDetail } from '../../recording-organizer/types';
import { AdminApiError } from './api';
import { getOrganizerComposition, listOrganizerCompositions, mergeOrganizerRecordings, reviewOrganizerComposition, splitOrganizerRecording, updateOrganizerRecording } from './recording-organizer-api';
import { completeSourceRecordingIds, nextPendingCompositionId, splitSourceRecording } from './recording-organizer-state';
import { recordingTypeOptions } from './resources';

type ReviewFilter = 'pending' | 'reviewed' | 'all';

interface MetadataDialogState {
	mode: 'edit' | 'merge';
	group: RecordingGroup;
	sourceRecordingIds?: string[];
}

const metadataFields: Array<{
	key: keyof RecordingMetadata;
	label: string;
	type: 'number' | 'date' | 'text' | 'textarea' | 'select';
}> = [
	{ key: 'versionName', label: 'バージョン名', type: 'text' },
	{ key: 'versionDescription', label: 'バージョンの特徴', type: 'textarea' },
	{ key: 'recordingYear', label: '録音年', type: 'number' },
	{ key: 'type', label: '種別', type: 'select' },
	{ key: 'recordedDate', label: '録音日', type: 'date' },
	{ key: 'recordedFrom', label: '録音開始日', type: 'date' },
	{ key: 'recordedTo', label: '録音終了日', type: 'date' },
	{ key: 'releaseDate', label: '公開日', type: 'date' },
	{ key: 'notes', label: 'メモ', type: 'textarea' },
];

function metadataFromGroup(group: RecordingGroup): RecordingMetadata {
	return {
		versionName: group.versionName,
		versionDescription: group.versionDescription,
		recordingYear: group.recordingYear,
		type: group.type,
		recordedDate: group.recordedDate,
		recordedFrom: group.recordedFrom,
		recordedTo: group.recordedTo,
		releaseDate: group.releaseDate,
		notes: group.notes,
	};
}

function selectedKeysForGroup(group: RecordingGroup, selectedTrackIds: ReadonlySet<string>) {
	return new Set(group.tracks.filter((track) => selectedTrackIds.has(track.id)).map((track) => track.id));
}

function metadataSummary(group: RecordingGroup): string {
	return [group.versionName, group.recordingYear, group.type, group.recordedDate ?? group.recordedFrom].filter(Boolean).join(' · ');
}

export function RecordingOrganizerScreen() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search);
	const [filter, setFilter] = useState<ReviewFilter>('pending');
	const [selectedCompositionId, setSelectedCompositionId] = useState<string>();
	const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(() => new Set());
	const [metadataDialog, setMetadataDialog] = useState<MetadataDialogState>();
	const [splitGroup, setSplitGroup] = useState<RecordingGroup>();
	const [message, setMessage] = useState('');

	const listQuery = useQuery({
		queryKey: ['recording-organizer', 'list', deferredSearch, filter],
		queryFn: () =>
			listOrganizerCompositions({
				search: deferredSearch,
				status: filter,
				page: 1,
				pageSize: 500,
			}),
	});
	const detailQuery = useQuery({
		queryKey: ['recording-organizer', 'detail', selectedCompositionId],
		queryFn: () => getOrganizerComposition(selectedCompositionId!),
		enabled: Boolean(selectedCompositionId),
	});

	const invalidateComposition = async (compositionId: string) => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: ['recording-organizer', 'list'],
			}),
			queryClient.invalidateQueries({
				queryKey: ['recording-organizer', 'detail', compositionId],
			}),
		]);
	};

	const mergeMutation = useMutation({
		mutationFn: mergeOrganizerRecordings,
		onSuccess: async ({ compositionId }) => {
			setMetadataDialog(undefined);
			setSelectedTrackIds(new Set());
			setMessage('録音を統合しました。');
			await invalidateComposition(compositionId);
		},
		onError: (error, input) => {
			if (error instanceof AdminApiError && error.body?.error.code === 'METADATA_CONFLICT') {
				const target = detailQuery.data?.groups.find((group) => group.id === input.targetRecordingId);
				if (target) {
					setMetadataDialog({
						mode: 'merge',
						group: target,
						sourceRecordingIds: input.sourceRecordingIds,
					});
					setMessage('録音情報に差があります。統合後の値を確認してください。');
					return;
				}
			}
			setMessage(error instanceof Error ? error.message : '統合できませんでした。');
		},
	});

	const splitMutation = useMutation({
		mutationFn: splitOrganizerRecording,
		onSuccess: async ({ compositionId }) => {
			setSplitGroup(undefined);
			setSelectedTrackIds(new Set());
			setMessage('選択したトラックを別録音に分けました。');
			await invalidateComposition(compositionId);
		},
		onError: (error) => setMessage(error instanceof Error ? error.message : '分割できませんでした。'),
	});

	const editMutation = useMutation({
		mutationFn: (input: { compositionId: string; recordingId: string; metadata: RecordingMetadata }) => updateOrganizerRecording(input.compositionId, input.recordingId, input.metadata),
		onSuccess: async (_, input) => {
			setMetadataDialog(undefined);
			setMessage('録音情報を保存しました。');
			await invalidateComposition(input.compositionId);
		},
		onError: (error) => setMessage(error instanceof Error ? error.message : '保存できませんでした。'),
	});

	const reviewMutation = useMutation({
		mutationFn: reviewOrganizerComposition,
		onSuccess: async (_, compositionId) => {
			setMessage('整理済みにしました。');
			await invalidateComposition(compositionId);
		},
		onError: (error) => setMessage(error instanceof Error ? error.message : '整理状態を保存できませんでした。'),
	});

	const isSaving = mergeMutation.isPending || splitMutation.isPending || editMutation.isPending || reviewMutation.isPending;
	const items = listQuery.data?.data ?? [];
	const detail = detailQuery.data;

	const selectComposition = (id: string) => {
		setSelectedCompositionId(id);
		setSelectedTrackIds(new Set());
		setMessage('');
	};

	const updateGroupSelection = (group: RecordingGroup, selection: Selection) => {
		setSelectedTrackIds((current) => {
			const next = new Set(current);
			for (const track of group.tracks) next.delete(track.id);
			const selected = selection === 'all' ? group.tracks.map((track) => track.id) : [...selection].map(String);
			for (const id of selected) next.add(id);
			return next;
		});
	};

	const mergeInto = (target: RecordingGroup) => {
		if (!detail) return;
		const sourceRecordingIds = completeSourceRecordingIds(detail, selectedTrackIds, target.id);
		if (sourceRecordingIds.length === 0) {
			setMessage('統合する録音のトラックをすべて選択してください。統合先のトラックは選択しません。');
			return;
		}
		mergeMutation.mutate({
			targetRecordingId: target.id,
			sourceRecordingIds,
		});
	};

	const openSplit = () => {
		if (!detail) return;
		const source = splitSourceRecording(detail, selectedTrackIds);
		if (!source) {
			setMessage('一つの録音から、一部のトラックだけを選択してください。');
			return;
		}
		setSplitGroup(source);
	};

	const goToNextPending = () => {
		const next = nextPendingCompositionId(items, selectedCompositionId);
		if (next) selectComposition(next);
		else setMessage('この一覧に未整理の楽曲はありません。');
	};

	return (
		<div className="resource-page recording-organizer-page">
			<header className="page-header organizer-header">
				<div>
					<p className="eyebrow">Human review</p>
					<h1>録音整理</h1>
					<p>同じ録音をまとめ、例外となる別録音だけを人間が分けます。</p>
				</div>
				<Button className="button secondary" onPress={goToNextPending} isDisabled={isSaving || items.length === 0}>
					次の未整理
				</Button>
			</header>

			<div className="organizer-layout">
				<section className="organizer-queue data-card" aria-label="楽曲キュー">
					<div className="organizer-filter">
						<SearchField aria-label="楽曲名を検索" className="search-field" value={search} onChange={setSearch}>
							<Search size={17} />
							<Input placeholder="楽曲名を検索" />
							{search ? (
								<Button aria-label="検索をクリア" onPress={() => setSearch('')}>
									<X size={15} />
								</Button>
							) : null}
						</SearchField>
						<div className="organizer-tabs" aria-label="整理状態">
							{(['pending', 'reviewed', 'all'] as const).map((status) => (
								<Button key={status} className={filter === status ? 'is-active' : ''} onPress={() => setFilter(status)}>
									{status === 'pending' ? `未整理 ${listQuery.data?.meta.pending ?? 0}` : status === 'reviewed' ? `整理済み ${listQuery.data?.meta.reviewed ?? 0}` : 'すべて'}
								</Button>
							))}
						</div>
					</div>

					{listQuery.isLoading ? (
						<OrganizerMessage icon={<LoaderCircle className="spin" />}>読み込み中</OrganizerMessage>
					) : listQuery.isError ? (
						<OrganizerMessage icon={<CircleAlert />}>楽曲を読み込めませんでした</OrganizerMessage>
					) : (
						<Table
							aria-label="録音を整理する楽曲"
							className="organizer-table queue-table"
							selectionMode="single"
							selectedKeys={selectedCompositionId ? new Set([selectedCompositionId]) : new Set()}
							onRowAction={(key) => selectComposition(String(key))}
						>
							<TableHeader>
								<Column isRowHeader>楽曲</Column>
								<Column>トラック</Column>
								<Column>録音</Column>
							</TableHeader>
							<TableBody items={items} renderEmptyState={() => '該当する楽曲はありません'}>
								{(item) => (
									<Row id={item.id}>
										<Cell>
											<strong>{item.title}</strong>
											<small>{item.status === 'reviewed' ? '整理済み' : '未整理'}</small>
										</Cell>
										<Cell>{item.trackCount}</Cell>
										<Cell>{item.recordingCount}</Cell>
									</Row>
								)}
							</TableBody>
						</Table>
					)}
				</section>

				<section className="organizer-detail" aria-label="録音グループ">
					{!selectedCompositionId ? (
						<OrganizerMessage>左の楽曲を選択してください</OrganizerMessage>
					) : detailQuery.isLoading ? (
						<OrganizerMessage icon={<LoaderCircle className="spin" />}>録音を読み込み中</OrganizerMessage>
					) : detailQuery.isError || !detail ? (
						<OrganizerMessage icon={<CircleAlert />}>録音を読み込めませんでした</OrganizerMessage>
					) : (
						<>
							<header className="organizer-detail-header">
								<div>
									<p className="eyebrow">Composition</p>
									<h2>{detail.title}</h2>
									<p>
										{detail.groups.length}録音・
										{detail.groups.reduce((total, group) => total + group.tracks.length, 0)}
										トラック
									</p>
									<p className="selection-hint">統合は元録音の全トラック、分割は一つの録音の一部だけを選択します。</p>
								</div>
								<div className="organizer-detail-actions">
									<Button className="button secondary small" onPress={openSplit} isDisabled={isSaving || selectedTrackIds.size === 0}>
										<Scissors size={16} />
										選択を別録音に分割
									</Button>
									<Button className="button primary small" onPress={() => reviewMutation.mutate(detail.id)} isDisabled={isSaving}>
										<Check size={16} />
										整理済みにする
									</Button>
								</div>
							</header>

							<div className="recording-groups">
								{detail.groups.map((group, index) => (
									<RecordingGroupCard
										key={group.id}
										group={group}
										index={index}
										selectedKeys={selectedKeysForGroup(group, selectedTrackIds)}
										isSaving={isSaving}
										onSelectionChange={(selection) => updateGroupSelection(group, selection)}
										onMerge={() => mergeInto(group)}
										onEdit={() => setMetadataDialog({ mode: 'edit', group })}
									/>
								))}
							</div>
						</>
					)}
				</section>
			</div>

			<p className="organizer-message" aria-live="polite">
				{isSaving ? '保存中…' : message}
			</p>

			{metadataDialog && detail ? (
				<MetadataDialog
					state={metadataDialog}
					isSaving={isSaving}
					onClose={() => setMetadataDialog(undefined)}
					onSave={(metadata) => {
						if (metadataDialog.mode === 'merge') {
							mergeMutation.mutate({
								targetRecordingId: metadataDialog.group.id,
								sourceRecordingIds: metadataDialog.sourceRecordingIds ?? [],
								metadata,
							});
						} else {
							editMutation.mutate({
								compositionId: detail.id,
								recordingId: metadataDialog.group.id,
								metadata,
							});
						}
					}}
				/>
			) : null}

			{splitGroup && detail ? (
				<SplitDialog
					group={splitGroup}
					selectedTrackIds={selectedTrackIds}
					isSaving={isSaving}
					onClose={() => setSplitGroup(undefined)}
					onSplit={(metadata, contributionIds) =>
						splitMutation.mutate({
							sourceRecordingId: splitGroup.id,
							trackIds: splitGroup.tracks.filter((track) => selectedTrackIds.has(track.id)).map((track) => track.id),
							metadata,
							contributionIds,
						})
					}
				/>
			) : null}
		</div>
	);
}

function RecordingGroupCard({
	group,
	index,
	selectedKeys,
	isSaving,
	onSelectionChange,
	onMerge,
	onEdit,
}: {
	group: RecordingGroup;
	index: number;
	selectedKeys: Set<string>;
	isSaving: boolean;
	onSelectionChange: (selection: Selection) => void;
	onMerge: () => void;
	onEdit: () => void;
}) {
	return (
		<article className="recording-group">
			<header>
				<div>
					<p>録音 {String.fromCharCode(65 + index)}</p>
					<h3>{metadataSummary(group) || '録音情報なし'}</h3>
					{group.versionDescription ? <div className="recording-version-description">{group.versionDescription}</div> : null}
					<small>{group.id}</small>
				</div>
				<div>
					<Button className="button secondary small" onPress={onEdit} isDisabled={isSaving}>
						<Pencil size={14} />
						録音情報
					</Button>
					<Button className="button secondary small" onPress={onMerge} isDisabled={isSaving}>
						<GitMerge size={14} />
						選択をこの録音に統合
					</Button>
				</div>
			</header>

			<Table
				aria-label={`録音 ${String.fromCharCode(65 + index)} のトラック`}
				className="organizer-table track-table"
				selectionMode="multiple"
				selectionBehavior="toggle"
				selectedKeys={selectedKeys}
				onSelectionChange={onSelectionChange}
				disabledKeys={isSaving ? group.tracks.map((track) => track.id) : []}
			>
				<TableHeader>
					<Column aria-label="選択">
						<Checkbox slot="selection" aria-label="すべて選択" />
					</Column>
					<Column isRowHeader>リリース</Column>
					<Column>形式</Column>
					<Column>発売日</Column>
					<Column>曲順</Column>
					<Column>録音日</Column>
					<Column>メモ</Column>
				</TableHeader>
				<TableBody items={group.tracks}>
					{(track) => (
						<Row id={track.id} textValue={track.releaseTitle}>
							<Cell>
								<Checkbox slot="selection" aria-label={`${track.releaseTitle} ${track.releaseDate ?? '発売日不明'} #${track.trackNumber}を選択`} />
							</Cell>
							<Cell>{track.releaseTitle}</Cell>
							<Cell>{track.releaseFormat}</Cell>
							<Cell>{track.releaseDate ?? '—'}</Cell>
							<Cell>{track.trackNumber}</Cell>
							<Cell>{track.recordedDate ?? '—'}</Cell>
							<Cell>{track.notes ?? '—'}</Cell>
						</Row>
					)}
				</TableBody>
			</Table>

			{group.contributions.length > 0 ? (
				<div className="contribution-list">
					<strong>参加者</strong>
					<ul>
						{group.contributions.map((contribution) => (
							<li key={contribution.id}>
								{contribution.personName} — {contribution.roleName}
								{contribution.instrumentName ? ` / ${contribution.instrumentName}` : ''}
								{contribution.notes ? ` — ${contribution.notes}` : ''}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</article>
	);
}

function MetadataDialog({ state, isSaving, onClose, onSave }: { state: MetadataDialogState; isSaving: boolean; onClose: () => void; onSave: (metadata: RecordingMetadata) => void }) {
	const [metadata, setMetadata] = useState<RecordingMetadata>(() => metadataFromGroup(state.group));
	return (
		<ModalOverlay
			className="modal-overlay"
			isOpen
			isDismissable={!isSaving}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<Modal className="editor-modal">
				<Dialog className="dialog">
					<header className="dialog-header">
						<div>
							<p className="eyebrow">{state.mode === 'merge' ? 'Merge recordings' : 'Recording'}</p>
							<Heading slot="title">{state.mode === 'merge' ? '統合後の録音情報' : '録音情報を編集'}</Heading>
						</div>
						<Button aria-label="閉じる" className="icon-button" onPress={onClose} isDisabled={isSaving}>
							<X size={18} />
						</Button>
					</header>
					<div className="editor-form">
						<MetadataFields metadata={metadata} onChange={setMetadata} />
						<div className="dialog-actions">
							<Button className="button secondary" onPress={onClose} isDisabled={isSaving}>
								キャンセル
							</Button>
							<Button className="button primary" onPress={() => onSave(metadata)} isDisabled={isSaving}>
								{state.mode === 'merge' ? 'この内容で統合' : '保存'}
							</Button>
						</div>
					</div>
				</Dialog>
			</Modal>
		</ModalOverlay>
	);
}

function SplitDialog({
	group,
	selectedTrackIds,
	isSaving,
	onClose,
	onSplit,
}: {
	group: RecordingGroup;
	selectedTrackIds: ReadonlySet<string>;
	isSaving: boolean;
	onClose: () => void;
	onSplit: (metadata: RecordingMetadata, contributionIds: string[]) => void;
}) {
	const [metadata, setMetadata] = useState<RecordingMetadata>(() => metadataFromGroup(group));
	const [contributionIds, setContributionIds] = useState<Set<string>>(() => new Set());
	return (
		<ModalOverlay
			className="modal-overlay"
			isOpen
			isDismissable={!isSaving}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<Modal className="editor-modal">
				<Dialog className="dialog">
					<header className="dialog-header">
						<div>
							<p className="eyebrow">Split recording</p>
							<Heading slot="title">別録音として分割</Heading>
						</div>
						<Button aria-label="閉じる" className="icon-button" onPress={onClose} isDisabled={isSaving}>
							<X size={18} />
						</Button>
					</header>
					<div className="editor-form">
						<p className="split-summary">
							{group.tracks.filter((track) => selectedTrackIds.has(track.id)).length}
							件のトラックを新しい録音へ移します。
						</p>
						<MetadataFields metadata={metadata} onChange={setMetadata} />
						<fieldset className="contribution-copy">
							<legend>新しい録音へコピーする参加者</legend>
							{group.contributions.length === 0 ? (
								<p>コピーできる参加者情報はありません。</p>
							) : (
								group.contributions.map((contribution) => (
									<Checkbox
										key={contribution.id}
										isSelected={contributionIds.has(contribution.id)}
										onChange={(selected) =>
											setContributionIds((current) => {
												const next = new Set(current);
												if (selected) next.add(contribution.id);
												else next.delete(contribution.id);
												return next;
											})
										}
									>
										<div className="checkbox-box">
											<Check size={13} />
										</div>
										{contribution.personName} — {contribution.roleName}
									</Checkbox>
								))
							)}
						</fieldset>
						<div className="dialog-actions">
							<Button className="button secondary" onPress={onClose} isDisabled={isSaving}>
								キャンセル
							</Button>
							<Button className="button primary" onPress={() => onSplit(metadata, [...contributionIds])} isDisabled={isSaving}>
								別録音として作成
							</Button>
						</div>
					</div>
				</Dialog>
			</Modal>
		</ModalOverlay>
	);
}

function MetadataFields({ metadata, onChange }: { metadata: RecordingMetadata; onChange: (metadata: RecordingMetadata) => void }) {
	return (
		<div className="form-grid">
			{metadataFields.map((field) => {
				const value = metadata[field.key];
				return (
					<label key={field.key} className={`field ${field.type === 'textarea' ? 'span-2' : ''}`}>
						<span>{field.label}</span>
						{field.type === 'textarea' ? (
							<textarea
								value={value == null ? '' : String(value)}
								onChange={(event) =>
									onChange({
										...metadata,
										[field.key]: event.target.value || null,
									})
								}
							/>
						) : field.type === 'select' ? (
							<select
								value={String(value)}
								onChange={(event) =>
									onChange({
										...metadata,
										[field.key]: event.target.value as RecordingType,
									})
								}
							>
								{recordingTypeOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						) : (
							<input
								type={field.type}
								value={value == null ? '' : String(value)}
								onChange={(event) =>
									onChange({
										...metadata,
										[field.key]: field.type === 'number' ? (event.target.value ? Number(event.target.value) : null) : event.target.value || null,
									})
								}
							/>
						)}
					</label>
				);
			})}
		</div>
	);
}

function OrganizerMessage({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
	return (
		<div className="organizer-empty">
			{icon}
			<p>{children}</p>
		</div>
	);
}
