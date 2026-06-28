import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Button, Input, SearchField } from "react-aria-components";
import { getRecord, listRecords } from "./api";
import { EditorDialog } from "./EditorDialog";
import {
  editorConfigs,
  relationDetailColumnKey,
  relationDetailTarget,
  resourceConfigs,
  selectRelationRows,
  type ColumnConfig,
  type DetailTarget,
  type EditorResource,
  type MainResource,
  type RelationConfig,
} from "./resources";

interface EditorState {
  resource: EditorResource;
  record?: Record<string, unknown> | undefined;
  defaults?: Record<string, string | boolean> | undefined;
}

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
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: config.defaultSort,
      desc: config.defaultDirection === "desc",
    },
  ]);
  const [editor, setEditor] = useState<EditorState>();
  const selectedId =
    detailTarget?.resource === resource ? detailTarget.id : undefined;
  const currentSort = sorting[0] ?? {
    id: config.defaultSort,
    desc: config.defaultDirection === "desc",
  };

  const listQuery = useQuery({
    queryKey: [
      "admin",
      "list",
      resource,
      deferredSearch,
      page,
      pageSize,
      currentSort.id,
      currentSort.desc,
    ],
    queryFn: () =>
      listRecords(resource, {
        search: deferredSearch,
        page,
        pageSize,
        sort: currentSort.id,
        direction: currentSort.desc ? "desc" : "asc",
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "detail", detailTarget?.resource, detailTarget?.id],
    queryFn: () =>
      getRecord(
        detailTarget?.resource as EditorResource,
        detailTarget?.id as string,
      ),
    enabled: Boolean(detailTarget),
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
    data: listQuery.data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting((current) =>
        typeof updater === "function" ? updater(current) : updater,
      );
      setPage(1);
    },
  });

  const total = listQuery.data?.meta.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const handleSaved = async (saved: Record<string, unknown>) => {
    setEditor(undefined);
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
    if (editor?.resource === resource && saved.id) {
      onOpenDetail({ resource, id: String(saved.id) });
    }
  };

  const openRelatedEditor = async (state: EditorState) => {
    if (state.record?.id) {
      const completeRecord = await getRecord(
        state.resource,
        String(state.record.id),
      );
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
        <Button
          className="button primary"
          onPress={() => setEditor({ resource })}
        >
          <Plus size={18} />
          {config.singular}を追加
        </Button>
      </header>

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
              <Button aria-label="検索をクリア" onPress={() => setSearch("")}>
                <X size={16} />
              </Button>
            ) : null}
          </SearchField>
          <div className="record-count">
            <strong>{total.toLocaleString("ja-JP")}</strong>
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
                          <button
                            type="button"
                            className="sort-button"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {sorted === "asc" ? (
                              <ArrowUp size={14} />
                            ) : sorted === "desc" ? (
                              <ArrowDown size={14} />
                            ) : (
                              <ArrowUpDown size={14} />
                            )}
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState icon={<LoaderCircle className="spin" />} text="読み込み中" />
                  </td>
                </tr>
              ) : listQuery.isError ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState icon={<CircleAlert />} text="データを読み込めませんでした" />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState icon={<Search />} text="該当するレコードがありません" />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={selectedId === row.original.id ? "is-selected" : ""}
                    tabIndex={0}
                    onClick={() =>
                      onOpenDetail({
                        resource,
                        id: String(row.original.id),
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenDetail({
                          resource,
                          id: String(row.original.id),
                        });
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
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
            {total === 0 ? 0 : (page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} / {total}
          </span>
          <div>
            <Button
              aria-label="前のページ"
              className="icon-button"
              isDisabled={page <= 1}
              onPress={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft size={18} />
            </Button>
            <span>{page} / {pageCount}</span>
            <Button
              aria-label="次のページ"
              className="icon-button"
              isDisabled={page >= pageCount}
              onPress={() => setPage((value) => Math.min(pageCount, value + 1))}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        </footer>
      </section>

      {detailTarget ? (
        <DetailPanel
          resource={detailTarget.resource}
          record={detailQuery.data}
          isLoading={detailQuery.isLoading}
          onClose={onCloseDetail}
          onEdit={(record) =>
            setEditor({ resource: detailTarget.resource, record })
          }
          onEditRelated={openRelatedEditor}
          onOpenDetail={onOpenDetail}
        />
      ) : null}

      {editor ? (
        <EditorDialog
          resource={editor.resource}
          record={editor.record}
          defaults={editor.defaults}
          onClose={() => setEditor(undefined)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}

function DetailPanel({
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
  onEditRelated: (state: EditorState) => void;
  onOpenDetail: (target: DetailTarget) => void;
}) {
  const config = editorConfigs[resource];
  const related = (record?.related ?? {}) as Record<
    string,
    Array<Record<string, unknown>>
  >;

  return (
    <aside className="detail-panel">
      <header className="detail-header">
        <div>
          <p className="eyebrow">Record detail</p>
          <h2>{record ? primaryLabel(record) : "読み込み中"}</h2>
        </div>
        <Button
          aria-label="詳細を閉じる"
          className="icon-button"
          onPress={onClose}
        >
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
              .filter((field) => field.type !== "target")
              .map((field) => (
                <div key={field.key} className={field.span === 2 ? "span-2" : ""}>
                  <dt>{field.label}</dt>
                  <dd>
                    {formatValue(
                      resolvedDisplayValue(record, field.key),
                      field.type === "checkbox" ? "boolean" : undefined,
                    )}
                  </dd>
                </div>
              ))}
          </dl>

          {(config.relations ?? []).map((relation) => (
            <RelationSection
              key={relation.key}
              relation={relation}
              rows={selectRelationRows(related, relation)}
              parentId={String(record.id)}
              onEdit={onEditRelated}
              onOpenDetail={onOpenDetail}
            />
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
  onEdit: (state: EditorState) => void;
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
                  ...(relation.parentField
                    ? { [relation.parentField]: parentId }
                    : {}),
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
                  {relation.columns.map((column) => (
                    <td key={column.key}>
                      {column.key === relationDetailColumnKey(relation) &&
                      relationDetailTarget(relation, row) ? (
                        <Button
                          className="relation-primary-link"
                          onPress={() => {
                            const target = relationDetailTarget(relation, row);
                            if (target) onOpenDetail(target);
                          }}
                        >
                          <CellValue value={row[column.key]} column={column} />
                        </Button>
                      ) : (
                        <CellValue value={row[column.key]} column={column} />
                      )}
                    </td>
                  ))}
                  {relation.resource && !relation.readonly ? (
                    <td className="relation-actions">
                      <Button
                        aria-label={`${relation.label}を編集`}
                        className="mini-button"
                        onPress={() =>
                          onEdit({
                            resource: relation.resource as EditorResource,
                            record: row,
                            defaults: relation.parentField
                              ? { [relation.parentField]: parentId }
                              : undefined,
                          })
                        }
                      >
                        <Pencil size={14} />
                      </Button>
                      {relation.nestedAction ? (
                        <>
                          {nestedRows(row, relation).map((nested) => (
                            <Button
                              key={String(nested.id)}
                              className="mini-button labeled nested-edit"
                              onPress={() =>
                                onEdit({
                                  resource: relation.nestedAction
                                    ?.resource as EditorResource,
                                  record: nested,
                                  defaults: {
                                    [relation.nestedAction
                                      ?.parentField as string]: String(row.id),
                                  },
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
                                resource: relation.nestedAction
                                  ?.resource as EditorResource,
                                defaults: {
                                  [relation.nestedAction
                                    ?.parentField as string]: String(row.id),
                                },
                              })
                            }
                          >
                            <Plus size={13} />
                            {relation.nestedAction.label}
                          </Button>
                        </>
                      ) : null}
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

function nestedRows(
  row: Record<string, unknown>,
  relation: RelationConfig,
): Array<Record<string, unknown>> {
  const value = relation.nestedAction
    ? row[relation.nestedAction.itemsKey]
    : undefined;
  return Array.isArray(value) ? value : [];
}

function nestedLabel(record: Record<string, unknown>): string {
  return String(
    record.name ??
      record.roleName ??
      record.instrumentName ??
      "編集",
  );
}

function CellValue({ value, column }: { value: unknown; column: ColumnConfig }) {
  return (
    <span className={column.kind === "muted" ? "muted-value" : undefined}>
      {formatValue(value, column.kind)}
    </span>
  );
}

function formatValue(value: unknown, kind?: ColumnConfig["kind"]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return String(item);
        const record = item as Record<string, unknown>;
        return String(
          record.name ??
            record.roleName ??
            record.instrumentName ??
            record.label ??
            "",
        );
      })
      .filter(Boolean)
      .join("、") || "—";
  }
  if (kind === "boolean") return value ? "はい" : "いいえ";
  if (kind === "number" && typeof value === "number") {
    return value.toLocaleString("ja-JP");
  }
  if (kind === "date") {
    const date = String(value).slice(0, 10);
    return date.replaceAll("-", ".");
  }
  return String(value);
}

function resolvedDisplayValue(record: Record<string, unknown>, key: string): unknown {
  if (key.endsWith("Id")) {
    return record[key.replace(/Id$/, "Name")] ?? record[key];
  }
  return record[key];
}

function primaryLabel(record: Record<string, unknown>): string {
  return String(
    record.name ??
      record.title ??
      record.eventName ??
      record.personName ??
      record.id,
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="empty-state">
      {icon}
      <span>{text}</span>
    </div>
  );
}
