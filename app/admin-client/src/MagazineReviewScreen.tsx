import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, CircleAlert, ExternalLink, FileQuestion, LoaderCircle, Search, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Button, Input, Label, RadioButton, RadioField, RadioGroup, SearchField, TextArea, TextField } from 'react-aria-components';
import type { HumanReviewDecisionStatus, HumanReviewStatus, MagazineReviewDecisionInput, MagazineReviewListRecord } from '../../magazine-review/types';
import type { ReviewStatus } from '../../../scripts/lib/magazineTsv';
import { getMagazineReviewDataset, saveMagazineReviewDecision } from './magazine-review-api';
import { filterMagazineReviewRecords, nextPendingMagazineRecord } from './magazine-review-state';

const parseStatusLabels: Record<ReviewStatus, string> = {
	confirmed: '確定候補',
	inferred: '推定',
	unresolved: '要確認',
	not_published: '非掲載',
};

const humanStatusLabels: Record<HumanReviewStatus, string> = {
	pending: '未確認',
	approved: '承認',
	needs_changes: '要修正',
	excluded: '対象外',
};

const emptyRecords: MagazineReviewListRecord[] = [];

const articleTypeLabels = {
	interview: 'インタビュー',
	column: 'コラム',
	live_report: 'ライブレポート',
	review: 'レビュー',
} as const;

function HumanStatusBadge({ status }: { status: HumanReviewStatus }) {
	return <span className={`review-badge human-${status}`}>{humanStatusLabels[status]}</span>;
}

function ReviewQueueItem({ record }: { record: MagazineReviewListRecord }) {
	const date = (record.issue.publishedDate ?? record.rawFields.publishedDate) || '発売日不明';
	return (
		<>
			<div className="magazine-queue-title">
				<strong>{record.publication.name || '媒体名不明'}</strong>
				<HumanStatusBadge status={record.humanReview.status} />
			</div>
			<span>{[record.rawFields.issue || '号数不明', date].join(' · ')}</span>
			<small>
				{record.subject.name ?? record.rawFields.band} · {parseStatusLabels[record.reviewStatus]}
			</small>
		</>
	);
}

function CandidateList({ label, values }: { label: string; values: string[] }) {
	if (values.length === 0) return null;
	return (
		<div className="candidate-group">
			<dt>{label}</dt>
			<dd>{values.join(' / ')}</dd>
		</div>
	);
}

function ReviewDecisionForm({ record, isSaving, onSave }: { record: MagazineReviewListRecord; isSaving: boolean; onSave: (input: MagazineReviewDecisionInput) => void }) {
	const initialStatus = record.humanReview.status === 'pending' ? 'approved' : record.humanReview.status;
	const [status, setStatus] = useState<HumanReviewDecisionStatus>(initialStatus);
	const [notes, setNotes] = useState(record.humanReview.notes);

	return (
		<section className="magazine-decision-card" aria-label="人手レビュー">
			<div>
				<p className="section-label">人手レビュー</p>
				<HumanStatusBadge status={record.humanReview.status} />
			</div>
			<RadioGroup aria-label="判定" className="decision-radios" value={status} onChange={(value) => setStatus(value as HumanReviewDecisionStatus)} orientation="horizontal">
				<RadioField className="decision-radio-field" value="approved">
					<RadioButton className="decision-radio-button">
						<span className="radio-dot" />
						承認
					</RadioButton>
				</RadioField>
				<RadioField className="decision-radio-field" value="needs_changes">
					<RadioButton className="decision-radio-button">
						<span className="radio-dot" />
						要修正
					</RadioButton>
				</RadioField>
				<RadioField className="decision-radio-field" value="excluded">
					<RadioButton className="decision-radio-button">
						<span className="radio-dot" />
						対象外
					</RadioButton>
				</RadioField>
			</RadioGroup>
			<TextField className="decision-notes" value={notes} onChange={setNotes}>
				<Label>確認メモ</Label>
				<TextArea rows={3} placeholder="確認した根拠や、追加で調べること" />
			</TextField>
			<Button className="button primary" isDisabled={isSaving} onPress={() => onSave({ status, notes })}>
				<Check size={16} />
				{isSaving ? '保存中' : '判定を保存'}
			</Button>
		</section>
	);
}

function MagazineRecordDetail({ record, isSaving, onSave }: { record: MagazineReviewListRecord; isSaving: boolean; onSave: (input: MagazineReviewDecisionInput) => void }) {
	const extractionGroups = [
		['ページ', record.extracted.pageReferences],
		['作品', record.extracted.workCandidates],
		['イベント日', record.extracted.eventDateCandidates],
	] as const;

	return (
		<article className="magazine-detail">
			<header className="magazine-detail-header">
				<div>
					<div className="magazine-detail-badges">
						<span className={`review-badge parse-${record.reviewStatus}`}>{parseStatusLabels[record.reviewStatus]}</span>
						<span className="review-badge">{record.classificationSource}</span>
					</div>
					<h2>{record.publication.name || '媒体名不明'}</h2>
					<p>{[record.rawFields.issue || '号数不明', record.rawFields.publishedDate || '発売日不明', record.subject.name ?? record.rawFields.band].join(' · ')}</p>
				</div>
				<code title={record.sourceKey}>{record.sourceKey.slice(0, 10)}</code>
			</header>

			<section className="magazine-section">
				<p className="section-label">構造化候補</p>
				<dl className="magazine-fields">
					<div>
						<dt>媒体</dt>
						<dd>{record.publication.name || '—'}</dd>
					</div>
					<div>
						<dt>号数</dt>
						<dd>{record.issue.issueNumber ?? '—'}</dd>
					</div>
					<div>
						<dt>発売日</dt>
						<dd>
							{record.issue.publishedDate ?? '—'} <small>{record.issue.datePrecision}</small>
						</dd>
					</div>
					<div>
						<dt>対象</dt>
						<dd>
							{record.subject.name ?? '未解決'} <small>{record.subject.kind}</small>
						</dd>
					</div>
				</dl>
			</section>

			<section className="magazine-section">
				<p className="section-label">記事候補</p>
				<div className="article-candidates">
					{record.articles.map((article) => (
						<div className="article-candidate" key={article.articleKey}>
							<div>
								<strong>{article.title}</strong>
								<span>{article.type ? articleTypeLabels[article.type] : '分類未確定'}</span>
							</div>
							<p>{article.content || '内容なし'}</p>
							{article.diagnostics.length > 0 ? <small>{article.diagnostics.join(' / ')}</small> : null}
						</div>
					))}
				</div>
			</section>

			<section className="magazine-section raw-section">
				<p className="section-label">原文</p>
				<blockquote>{record.rawFields.content || '（掲載内容なし）'}</blockquote>
				<dl className="raw-fields">
					<div>
						<dt>バンド</dt>
						<dd>{record.rawFields.band || '—'}</dd>
					</div>
					<div>
						<dt>分類</dt>
						<dd>{record.rawFields.classification || '—'}</dd>
					</div>
				</dl>
			</section>

			{record.diagnostics.length > 0 ? (
				<section className="magazine-section diagnostic-section">
					<p className="section-label">
						<CircleAlert size={14} /> 診断
					</p>
					<ul>
						{record.diagnostics.map((diagnostic) => (
							<li key={diagnostic}>{diagnostic}</li>
						))}
					</ul>
				</section>
			) : null}

			<section className="magazine-section">
				<p className="section-label">抽出候補</p>
				<dl className="candidate-list">
					{extractionGroups.map(([label, values]) => (
						<CandidateList key={label} label={label} values={[...values]} />
					))}
					{record.extracted.urls.length > 0 ? (
						<div className="candidate-group">
							<dt>URL</dt>
							<dd>
								{record.extracted.urls.map((url) => (
									<a href={url} key={url} rel="noreferrer" target="_blank">
										{url} <ExternalLink size={12} />
									</a>
								))}
							</dd>
						</div>
					) : null}
					{extractionGroups.every(([, values]) => values.length === 0) && record.extracted.urls.length === 0 ? <dd className="muted">抽出候補はありません</dd> : null}
				</dl>
			</section>

			<ReviewDecisionForm key={record.sourceKey} record={record} isSaving={isSaving} onSave={onSave} />
		</article>
	);
}

export function MagazineReviewScreen() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search);
	const [parseStatus, setParseStatus] = useState<ReviewStatus | 'all'>('all');
	const [humanStatus, setHumanStatus] = useState<HumanReviewStatus | 'all'>('pending');
	const [selectedSourceKey, setSelectedSourceKey] = useState<string>();
	const [message, setMessage] = useState('');
	const datasetQuery = useQuery({
		queryKey: ['magazine-review'],
		queryFn: getMagazineReviewDataset,
	});
	const records = datasetQuery.data?.records ?? emptyRecords;
	const filteredRecords = useMemo(() => filterMagazineReviewRecords(records, { search: deferredSearch, parseStatus, humanStatus }), [deferredSearch, humanStatus, parseStatus, records]);
	const selectedRecord = filteredRecords.find(({ sourceKey }) => sourceKey === selectedSourceKey) ?? filteredRecords[0];

	const decisionMutation = useMutation({
		mutationFn: ({ sourceKey, input }: { sourceKey: string; input: MagazineReviewDecisionInput }) => saveMagazineReviewDecision(sourceKey, input),
		onSuccess: async () => {
			setMessage('判定を保存しました。');
			await queryClient.invalidateQueries({ queryKey: ['magazine-review'] });
		},
		onError: (error) => setMessage(error instanceof Error ? error.message : '判定を保存できませんでした。'),
	});

	const goToNextPending = () => {
		const next = nextPendingMagazineRecord(records, selectedRecord?.sourceKey);
		if (next) {
			setHumanStatus('all');
			setSelectedSourceKey(next);
			setMessage('');
		} else {
			setMessage('この先に未確認レコードはありません。');
		}
	};

	const selectRecordKey = (sourceKey: string) => {
		setSelectedSourceKey(sourceKey);
		setMessage('');
	};

	return (
		<div className="resource-page magazine-review-page">
			<header className="page-header magazine-review-header">
				<div>
					<p className="eyebrow">Human review</p>
					<h1>雑誌掲載レビュー</h1>
					<p>TSVの原文と構造化候補を見比べ、DB投入前の判定を残します。</p>
				</div>
				<div className="magazine-header-actions">
					<div className="review-progress">
						<strong>{datasetQuery.data?.meta.humanReviewStatuses.pending ?? 0}</strong>
						<span>未確認 / {datasetQuery.data?.summary.sourceRows ?? 0}件</span>
					</div>
					<Button className="button secondary" onPress={goToNextPending} isDisabled={records.length === 0}>
						次の未確認 <ArrowRight size={16} />
					</Button>
				</div>
			</header>

			<div className="magazine-review-layout">
				<section className="magazine-queue data-card" aria-label="掲載情報キュー">
					<div className="magazine-filter">
						<SearchField aria-label="媒体名や掲載内容を検索" className="search-field" value={search} onChange={setSearch}>
							<Search size={17} />
							<Input placeholder="媒体・号数・内容を検索" />
							{search ? (
								<Button aria-label="検索をクリア" onPress={() => setSearch('')}>
									<X size={15} />
								</Button>
							) : null}
						</SearchField>
						<div className="magazine-filter-selects">
							<label>
								<span>人手判定</span>
								<select value={humanStatus} onChange={(event) => setHumanStatus(event.target.value as HumanReviewStatus | 'all')}>
									<option value="all">すべて</option>
									{Object.entries(humanStatusLabels).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
							</label>
							<label>
								<span>解析結果</span>
								<select value={parseStatus} onChange={(event) => setParseStatus(event.target.value as ReviewStatus | 'all')}>
									<option value="all">すべて</option>
									{Object.entries(parseStatusLabels).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
							</label>
						</div>
						<p>{filteredRecords.length}件を表示</p>
					</div>

					{datasetQuery.isLoading ? (
						<div className="magazine-empty">
							<LoaderCircle className="spin" /> 読み込み中
						</div>
					) : datasetQuery.isError ? (
						<div className="magazine-empty">
							<CircleAlert /> データを読み込めませんでした
						</div>
					) : (
						<div role="list" aria-label="レビューする掲載情報" className="magazine-listbox">
							{filteredRecords.map((record) => (
								<Button
									className={`magazine-list-item ${selectedRecord?.sourceKey === record.sourceKey ? 'is-selected' : ''}`}
									key={record.sourceKey}
									onPress={() => selectRecordKey(record.sourceKey)}
								>
									<ReviewQueueItem record={record} />
								</Button>
							))}
						</div>
					)}
				</section>

				<section className="magazine-detail-column" aria-label="掲載情報の詳細">
					{selectedRecord ? (
						<MagazineRecordDetail record={selectedRecord} isSaving={decisionMutation.isPending} onSave={(input) => decisionMutation.mutate({ sourceKey: selectedRecord.sourceKey, input })} />
					) : (
						<div className="magazine-no-selection">
							<FileQuestion size={30} />
							<p>条件に合う掲載情報はありません。</p>
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
