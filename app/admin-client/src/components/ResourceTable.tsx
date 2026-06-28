import { useQuery } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, Search, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Button, Input, SearchField } from 'react-aria-components';
import { listRecords } from '../api';
import { resourceConfigs, type DetailTarget, type MainResource } from '../resources';
import { CellValue, EmptyState } from './ResourceDisplay';

const EMPTY_RECORDS: Array<Record<string, unknown>> = [];

export function ResourceTable({ resource, selectedId, onOpenDetail }: { resource: MainResource; selectedId?: string | undefined; onOpenDetail: (target: DetailTarget) => void }) {
	const config = resourceConfigs[resource];
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(100);
	const [sorting, setSorting] = useState<SortingState>([
		{
			id: config.defaultSort,
			desc: config.defaultDirection === 'desc',
		},
	]);
	const currentSort = sorting[0] ?? {
		id: config.defaultSort,
		desc: config.defaultDirection === 'desc',
	};

	const listQuery = useQuery({
		queryKey: ['admin', 'list', resource, deferredSearch, page, pageSize, currentSort.id, currentSort.desc],
		queryFn: () =>
			listRecords(resource, {
				search: deferredSearch,
				page,
				pageSize,
				sort: currentSort.id,
				direction: currentSort.desc ? 'desc' : 'asc',
			}),
	});
	const columns = useMemo<Array<ColumnDef<Record<string, unknown>>>>(
		() =>
			config.columns.map((column) => ({
				id: column.key,
				accessorKey: column.key,
				header: column.label,
				enableSorting: column.sortable === true,
				cell: ({ getValue }) => <CellValue value={getValue()} column={column} />,
			})),
		[config.columns],
	);
	const table = useReactTable({
		data: listQuery.data?.data ?? EMPTY_RECORDS,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualSorting: true,
		state: { sorting },
		onSortingChange: (updater) => {
			setSorting((current) => (typeof updater === 'function' ? updater(current) : updater));
			setPage(1);
		},
	});

	const total = listQuery.data?.meta.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const openRow = (row: Record<string, unknown>) => {
		onOpenDetail({ resource, id: String(row.id) });
	};

	return (
		<section className="data-card">
			<div className="table-toolbar">
				<SearchField
					aria-label={`${config.title}を検索`}
					className="search-field"
					value={search}
					onChange={(value) => {
						setSearch(value);
						setPage(1);
					}}
				>
					<Search size={18} />
					<Input placeholder="名前、説明などを検索" />
					{search ? (
						<Button aria-label="検索をクリア" onPress={() => setSearch('')}>
							<X size={16} />
						</Button>
					) : null}
				</SearchField>
				<div className="record-count">
					<strong>{total.toLocaleString('ja-JP')}</strong>
					<span>records</span>
				</div>
			</div>

			<div className="table-scroll">
				<table className="data-table">
					<thead>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									const sorted = header.column.getIsSorted();
									return (
										<th key={header.id}>
											{header.column.getCanSort() ? (
												<button type="button" className="sort-button" onClick={header.column.getToggleSortingHandler()}>
													{flexRender(header.column.columnDef.header, header.getContext())}
													{sorted === 'asc' ? <ArrowUp size={14} /> : sorted === 'desc' ? <ArrowDown size={14} /> : <ArrowUpDown size={14} />}
												</button>
											) : (
												flexRender(header.column.columnDef.header, header.getContext())
											)}
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					<tbody>
						{listQuery.isLoading ? (
							<TableMessage columnCount={columns.length}>
								<EmptyState icon={<LoaderCircle className="spin" />} text="読み込み中" />
							</TableMessage>
						) : listQuery.isError ? (
							<TableMessage columnCount={columns.length}>
								<EmptyState icon={<CircleAlert />} text="データを読み込めませんでした" />
							</TableMessage>
						) : table.getRowModel().rows.length === 0 ? (
							<TableMessage columnCount={columns.length}>
								<EmptyState icon={<Search />} text="該当するレコードがありません" />
							</TableMessage>
						) : (
							table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className={selectedId === row.original.id ? 'is-selected' : ''}
									tabIndex={0}
									onClick={() => openRow(row.original)}
									onKeyDown={(event) => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											openRow(row.original);
										}
									}}
								>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			<footer className="pagination">
				<label>
					表示件数
					<select
						value={pageSize}
						onChange={(event) => {
							setPageSize(Number(event.target.value));
							setPage(1);
						}}
					>
						<option value="10">10</option>
						<option value="20">20</option>
						<option value="50">50</option>
						<option value="100">100</option>
					</select>
				</label>
				<span>
					{total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
				</span>
				<div>
					<Button aria-label="前のページ" className="icon-button" isDisabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))}>
						<ChevronLeft size={18} />
					</Button>
					<span>
						{page} / {pageCount}
					</span>
					<Button aria-label="次のページ" className="icon-button" isDisabled={page >= pageCount} onPress={() => setPage((value) => Math.min(pageCount, value + 1))}>
						<ChevronRight size={18} />
					</Button>
				</div>
			</footer>
		</section>
	);
}

function TableMessage({ columnCount, children }: { columnCount: number; children: React.ReactNode }) {
	return (
		<tr>
			<td colSpan={columnCount}>{children}</td>
		</tr>
	);
}
