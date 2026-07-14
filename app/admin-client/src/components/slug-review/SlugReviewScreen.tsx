import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, CircleAlert, Download, FileQuestion, LoaderCircle, Search, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Button, Input, Label, SearchField, TextField } from 'react-aria-components';
import type { SlugEntityType } from '../../../../../scripts/generate_slug_candidates';
import type { SlugReviewDecisionInput, SlugReviewListRecord, SlugReviewStatus } from '../../../../slug-review/types';
import { getSlugReviewArtifact, getSlugReviewDataset, saveSlugReviewDecision } from './api';
import { filterSlugReviewRecords, nextPendingSlugReviewRecord, slugReviewRecordKey, type SlugReviewFilter } from './state';

const entityLabels: Record<SlugEntityType, string> = {
	project: 'プロジェクト',
	person: '人物',
	composition: '楽曲',
	work: '作品',
	venue: '会場',
};

const candidateStatusLabels: Record<SlugReviewListRecord['status'], string> = {
	proposed: '自動候補',
	preserved: '既存slug',
	needs_review: '要確認',
};

const reviewStatusLabels: Record<SlugReviewStatus, string> = {
	pending: '未確認',
	approved: '承認済み',
	rejected: '対象外',
};

const emptyRecords: SlugReviewListRecord[] = [];

function ReviewStatusBadge({ status }: { status: SlugReviewStatus }) {
	return <span className={`review-badge slug-review-${status}`}>{reviewStatusLabels[status]}</span>;
}

function CandidateQueueItem({ record }: { record: SlugReviewListRecord }) {
	return (
		<>
			<div className="slug-queue-title">
				<strong>{record.displayName || '名前なし'}</strong>
				<ReviewStatusBadge status={record.review.status} />
			</div>
			<span>
				{entityLabels[record.entityType]} · {candidateStatusLabels[record.status]}
			</span>
			<small>
				{record.candidateSlug ?? '候補なし'} · {record.diagnostics.length > 0 ? `${record.diagnostics.length}件の診断` : '診断なし'}
			</small>
		</>
	);
}

function SlugDecisionForm({ record, isSaving, onSave }: { record: SlugReviewListRecord; isSaving: boolean; onSave: (input: SlugReviewDecisionInput) => void }) {
	const [slug, setSlug] = useState(record.review.slug ?? record.candidateSlug ?? '');
	const trimmedSlug = slug.trim();

	return (
		<section className="slug-decision-card" aria-label="slug判定">
			<div className="slug-decision-heading">
				<div>
					<p className="section-label">人手レビュー</p>
					<ReviewStatusBadge status={record.review.status} />
				</div>
				<small>承認するとレビューartifactに記録されます</small>
			</div>
			<TextField className="slug-decision-field" value={slug} onChange={setSlug}>
				<Label>確定するslug</Label>
				<Input aria-describedby="slug-format-help" placeholder="例: kadota-masaharu" />
			</TextField>
			<small id="slug-format-help" className="slug-format-help">
				小文字の英数字とハイフンのみ。対象外の場合はslugを空欄のまま保存できます。
			</small>
			<div className="slug-decision-actions">
				<Button className="button primary" isDisabled={isSaving || trimmedSlug.length === 0} onPress={() => onSave({ status: 'approved', slug: trimmedSlug })}>
					<Check size={16} />
					{isSaving ? '保存中' : 'slugを承認'}
				</Button>
				<Button className="button secondary" isDisabled={isSaving} onPress={() => onSave({ status: 'rejected', slug: null })}>
					対象外として保存
				</Button>
			</div>
		</section>
	);
}

function SlugRecordDetail({ record, isSaving, onSave }: { record: SlugReviewListRecord; isSaving: boolean; onSave: (input: SlugReviewDecisionInput) => void }) {
	return (
		<article className="slug-detail">
			<header className="slug-detail-header">
				<div>
					<div className="slug-detail-badges">
						<span className={`review-badge slug-candidate-${record.status}`}>{candidateStatusLabels[record.status]}</span>
						<ReviewStatusBadge status={record.review.status} />
					</div>
					<h2>{record.displayName || '名前なし'}</h2>
					<p>
						{entityLabels[record.entityType]} · {record.id}
					</p>
				</div>
				<code>{record.review.status === 'pending' ? '未保存' : '保存済み'}</code>
			</header>

			<section className="slug-section">
				<p className="section-label">候補の根拠</p>
				<dl className="slug-fields">
					<div>
						<dt>表示名</dt>
						<dd>{record.displayName || '—'}</dd>
					</div>
					<div>
						<dt>既存slug</dt>
						<dd>{record.existingSlug || 'なし'}</dd>
					</div>
					<div>
						<dt>自動候補</dt>
						<dd>{record.candidateSlug || '候補なし'}</dd>
					</div>
					<div>
						<dt>変換方法</dt>
						<dd>
							{record.basis.method} / {record.basis.source}
						</dd>
					</div>
				</dl>
			</section>

			{record.diagnostics.length > 0 ? (
				<section className="slug-section slug-diagnostic-section">
					<p className="section-label">
						<CircleAlert size={14} /> 確認ポイント
					</p>
					<ul>
						{record.diagnostics.map((diagnostic) => (
							<li key={`${diagnostic.code}-${diagnostic.message}`}>
								{diagnostic.message}
								{diagnostic.characters ? `（${diagnostic.characters}）` : ''}
							</li>
						))}
					</ul>
				</section>
			) : null}

			{record.collision ? (
				<section className="slug-section slug-diagnostic-section">
					<p className="section-label">
						<CircleAlert size={14} /> slug衝突
					</p>
					<p>「{record.collision.baseSlug}」に候補が重複しています。別のslugを入力してください。</p>
				</section>
			) : null}

			<SlugDecisionForm key={slugReviewRecordKey(record)} record={record} isSaving={isSaving} onSave={onSave} />
		</article>
	);
}

async function downloadReviewArtifact(): Promise<void> {
	const artifact = await getSlugReviewArtifact();
	const blob = new Blob([`${JSON.stringify(artifact, null, '\t')}\n`], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = 'slug-reviews.json';
	anchor.click();
	URL.revokeObjectURL(url);
}

export function SlugReviewScreen() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search);
	const [candidateStatus, setCandidateStatus] = useState<SlugReviewFilter['candidateStatus']>('needs_review');
	const [reviewStatus, setReviewStatus] = useState<SlugReviewFilter['reviewStatus']>('pending');
	const [selectedKey, setSelectedKey] = useState<string>();
	const [message, setMessage] = useState('');
	const datasetQuery = useQuery({ queryKey: ['slug-review'], queryFn: getSlugReviewDataset });
	const records = datasetQuery.data?.records ?? emptyRecords;
	const filteredRecords = useMemo(() => filterSlugReviewRecords(records, { search: deferredSearch, candidateStatus, reviewStatus }), [candidateStatus, deferredSearch, records, reviewStatus]);
	const selectedRecord = filteredRecords.find((record) => slugReviewRecordKey(record) === selectedKey) ?? filteredRecords[0];

	const decisionMutation = useMutation({
		mutationFn: ({ entityType, id, input }: { entityType: SlugEntityType; id: string; input: SlugReviewDecisionInput }) => saveSlugReviewDecision(entityType, id, input),
		onSuccess: async () => {
			setMessage('保存しました。次の未確認を表示します。');
			await queryClient.invalidateQueries({ queryKey: ['slug-review'] });
		},
		onError: (error) => setMessage(error instanceof Error ? error.message : 'slug判定を保存できませんでした。'),
	});

	const goToNextPending = () => {
		const nextKey = nextPendingSlugReviewRecord(filteredRecords, selectedRecord ? slugReviewRecordKey(selectedRecord) : undefined);
		if (nextKey) {
			setSelectedKey(nextKey);
			setMessage('');
		} else {
			setMessage('この条件に未確認レコードはありません。');
		}
	};

	return (
		<div className="resource-page slug-review-page">
			<header className="page-header slug-review-header">
				<div>
					<p className="eyebrow">Human review</p>
					<h1>slug候補レビュー</h1>
					<p>slug-candidates.jsonを直接編集せず、要確認の候補を1件ずつ確認して別artifactに保存します。</p>
				</div>
				<div className="slug-header-actions">
					<div className="review-progress">
						<strong>{datasetQuery.data?.meta.reviewStatuses.pending ?? 0}</strong>
						<span>未確認 / {datasetQuery.data?.summary.total ?? 0}件</span>
					</div>
					<Button className="button secondary" onPress={goToNextPending} isDisabled={filteredRecords.length === 0}>
						<ArrowRight size={16} /> 次の未確認
					</Button>
					<Button className="button secondary" onPress={() => void downloadReviewArtifact()}>
						<Download size={16} /> artifact出力
					</Button>
				</div>
			</header>

			<div className="slug-review-layout">
				<section className="slug-queue data-card" aria-label="slug候補キュー">
					<div className="slug-filter">
						<SearchField aria-label="表示名やslugを検索" className="search-field" value={search} onChange={setSearch}>
							<Search size={17} />
							<Input placeholder="表示名・slug・IDを検索" />
							{search ? (
								<Button aria-label="検索をクリア" onPress={() => setSearch('')}>
									<X size={15} />
								</Button>
							) : null}
						</SearchField>
						<div className="slug-filter-selects">
							<label>
								<span>候補状態</span>
								<select value={candidateStatus} onChange={(event) => setCandidateStatus(event.target.value as SlugReviewFilter['candidateStatus'])}>
									<option value="needs_review">要確認</option>
									<option value="proposed">自動候補</option>
									<option value="preserved">既存slug</option>
									<option value="all">すべて</option>
								</select>
							</label>
							<label>
								<span>人手判定</span>
								<select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as SlugReviewFilter['reviewStatus'])}>
									<option value="pending">未確認</option>
									<option value="approved">承認済み</option>
									<option value="rejected">対象外</option>
									<option value="all">すべて</option>
								</select>
							</label>
						</div>
						<p>{filteredRecords.length}件を表示</p>
					</div>

					{datasetQuery.isLoading ? (
						<div className="slug-empty">
							<LoaderCircle className="spin" /> 読み込み中
						</div>
					) : datasetQuery.isError ? (
						<div className="slug-empty">
							<CircleAlert /> 候補artifactを読み込めませんでした
						</div>
					) : (
						<div role="list" aria-label="レビューするslug候補" className="slug-listbox">
							{filteredRecords.map((record) => (
								<Button
									key={slugReviewRecordKey(record)}
									className={`slug-list-item ${selectedRecord && slugReviewRecordKey(selectedRecord) === slugReviewRecordKey(record) ? 'is-selected' : ''}`}
									onPress={() => {
										setSelectedKey(slugReviewRecordKey(record));
										setMessage('');
									}}
								>
									<CandidateQueueItem record={record} />
								</Button>
							))}
						</div>
					)}
				</section>

				<section className="slug-detail-column" aria-label="slug候補の詳細">
					{selectedRecord ? (
						<SlugRecordDetail
							record={selectedRecord}
							isSaving={decisionMutation.isPending}
							onSave={(input) => decisionMutation.mutate({ entityType: selectedRecord.entityType, id: selectedRecord.id, input })}
						/>
					) : (
						<div className="slug-no-selection">
							<FileQuestion size={30} />
							<p>条件に合うslug候補はありません。</p>
						</div>
					)}
					<p aria-live="polite" className="organizer-message">
						{message}
					</p>
				</section>
			</div>
		</div>
	);
}
