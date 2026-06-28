export type MainResource =
  | "people"
  | "projects"
  | "works"
  | "compositions"
  | "events"
  | "articles"
  | "contributions";

export type EditorResource =
  | MainResource
  | "memberships"
  | "membership-roles"
  | "releases"
  | "label-relations"
  | "recordings"
  | "tracks"
  | "event-performances"
  | "publication-issues"
  | "article-mentions"
  | "venues"
  | "roles"
  | "instruments"
  | "labels"
  | "distributors"
  | "publications";

export type LookupResource =
  | "project"
  | "person"
  | "composition"
  | "work"
  | "release"
  | "recording"
  | "event"
  | "publication-issue"
  | "venue"
  | "role"
  | "instrument"
  | "label"
  | "distributor"
  | "publication";

export interface ColumnConfig {
  key: string;
  label: string;
  sortable?: boolean;
  kind?: "date" | "number" | "boolean" | "muted";
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "date"
    | "time"
    | "number"
    | "url"
    | "select"
    | "combobox"
    | "checkbox"
    | "target";
  required?: boolean;
  lookup?: LookupResource;
  options?: SelectOption[];
  placeholder?: string;
  span?: 2;
}

export interface NestedActionConfig {
  label: string;
  resource: EditorResource;
  parentField: string;
  itemsKey: string;
}

export interface RelationConfig {
  key: string;
  label: string;
  resource?: EditorResource;
  parentField?: string;
  columns: ColumnConfig[];
  readonly?: boolean;
  nestedAction?: NestedActionConfig;
}

export interface ResourceConfig {
  title: string;
  singular: string;
  description: string;
  defaultSort: string;
  defaultDirection?: "asc" | "desc";
  columns: ColumnConfig[];
  fields: FieldConfig[];
  relations?: RelationConfig[];
}

const descriptionField: FieldConfig = {
  key: "description",
  label: "説明",
  type: "textarea",
  span: 2,
};
const notesField: FieldConfig = {
  key: "notes",
  label: "メモ",
  type: "textarea",
  span: 2,
};
const precisionOptions: SelectOption[] = [
  { value: "", label: "未指定" },
  { value: "day", label: "日" },
  { value: "month", label: "月" },
  { value: "year", label: "年" },
  { value: "approximate", label: "概算" },
];

export const mainResourceOrder: MainResource[] = [
  "people",
  "projects",
  "works",
  "compositions",
  "events",
  "articles",
  "contributions",
];

export const resourceConfigs: Record<MainResource, ResourceConfig> = {
  people: {
    title: "People",
    singular: "人物",
    description: "人物とプロジェクト参加履歴",
    defaultSort: "name",
    columns: [
      { key: "name", label: "名前", sortable: true },
      { key: "activeFrom", label: "活動開始", sortable: true, kind: "date" },
      { key: "activeTo", label: "活動終了", kind: "date" },
      { key: "description", label: "説明", kind: "muted" },
    ],
    fields: [
      { key: "name", label: "名前", type: "text", required: true, span: 2 },
      { key: "birthDate", label: "生年月日", type: "date" },
      { key: "deathDate", label: "死亡日", type: "date" },
      { key: "activeFrom", label: "活動開始", type: "date" },
      { key: "activeTo", label: "活動終了", type: "date" },
      descriptionField,
    ],
    relations: [
      {
        key: "memberships",
        label: "参加プロジェクト",
        resource: "memberships",
        parentField: "personId",
        columns: [
          { key: "projectName", label: "プロジェクト" },
          { key: "fromDate", label: "開始", kind: "date" },
          { key: "toDate", label: "終了", kind: "date" },
          { key: "roles", label: "役割" },
          { key: "note", label: "メモ", kind: "muted" },
        ],
        nestedAction: {
          label: "役割",
          resource: "membership-roles",
          parentField: "membershipId",
          itemsKey: "roles",
        },
      },
    ],
  },
  projects: {
    title: "Projects",
    singular: "プロジェクト",
    description: "バンド、ソロ、ユニット",
    defaultSort: "name",
    columns: [
      { key: "name", label: "名前", sortable: true },
      { key: "type", label: "種別", sortable: true },
      { key: "startDate", label: "開始", sortable: true, kind: "date" },
      { key: "endDate", label: "終了", kind: "date" },
    ],
    fields: [
      { key: "name", label: "名前", type: "text", required: true, span: 2 },
      {
        key: "type",
        label: "種別",
        type: "select",
        required: true,
        options: [
          { value: "band", label: "Band" },
          { value: "solo", label: "Solo" },
          { value: "unit", label: "Unit" },
          { value: "project", label: "Project" },
        ],
      },
      { key: "startDate", label: "開始日", type: "date" },
      { key: "endDate", label: "終了日", type: "date" },
      descriptionField,
    ],
    relations: [
      {
        key: "members",
        label: "メンバー",
        resource: "memberships",
        parentField: "projectId",
        columns: [
          { key: "personName", label: "人物" },
          { key: "fromDate", label: "開始", kind: "date" },
          { key: "toDate", label: "終了", kind: "date" },
          { key: "note", label: "メモ", kind: "muted" },
        ],
      },
      {
        key: "works",
        label: "作品",
        resource: "works",
        parentField: "projectId",
        columns: [
          { key: "title", label: "タイトル" },
          { key: "releasedDate", label: "リリース日", kind: "date" },
        ],
      },
      {
        key: "events",
        label: "イベント",
        resource: "events",
        parentField: "projectId",
        columns: [
          { key: "eventDate", label: "日付", kind: "date" },
          { key: "eventName", label: "イベント" },
          { key: "venueName", label: "会場" },
        ],
      },
    ],
  },
  works: {
    title: "Works / Releases",
    singular: "作品",
    description: "作品、具体リリース、ラベル、収録曲",
    defaultSort: "title",
    columns: [
      { key: "title", label: "タイトル", sortable: true },
      { key: "projectName", label: "プロジェクト", sortable: true },
      { key: "releasedDate", label: "代表リリース日", sortable: true, kind: "date" },
      { key: "releaseCount", label: "リリース", kind: "number" },
    ],
    fields: [
      {
        key: "projectId",
        label: "プロジェクト",
        type: "combobox",
        lookup: "project",
        required: true,
        span: 2,
      },
      { key: "title", label: "タイトル", type: "text", required: true, span: 2 },
      { key: "createdDate", label: "制作日", type: "date" },
      { key: "releasedDate", label: "代表リリース日", type: "date" },
      descriptionField,
    ],
    relations: [
      {
        key: "releases",
        label: "リリース",
        resource: "releases",
        parentField: "workId",
        columns: [
          { key: "format", label: "形式" },
          { key: "catalogNumber", label: "品番" },
          { key: "releaseDate", label: "発売日", kind: "date" },
          { key: "distributorName", label: "流通" },
          { key: "labels", label: "ラベル" },
        ],
        nestedAction: {
          label: "ラベル",
          resource: "label-relations",
          parentField: "releaseId",
          itemsKey: "labels",
        },
      },
      {
        key: "tracks",
        label: "収録曲",
        resource: "tracks",
        columns: [
          { key: "format", label: "リリース" },
          { key: "trackNumber", label: "#", kind: "number" },
          { key: "compositionTitle", label: "楽曲" },
          { key: "notes", label: "メモ", kind: "muted" },
        ],
      },
    ],
  },
  compositions: {
    title: "Compositions / Recordings",
    singular: "楽曲",
    description: "楽曲、録音バージョン、リリース・公演への登場",
    defaultSort: "title",
    columns: [
      { key: "title", label: "タイトル", sortable: true },
      { key: "recordingCount", label: "録音", kind: "number" },
      { key: "description", label: "説明", kind: "muted" },
    ],
    fields: [
      { key: "title", label: "タイトル", type: "text", required: true, span: 2 },
      descriptionField,
    ],
    relations: [
      {
        key: "recordings",
        label: "録音",
        resource: "recordings",
        parentField: "compositionId",
        columns: [
          { key: "recordingYear", label: "年", kind: "number" },
          { key: "type", label: "種別" },
          { key: "recordedDate", label: "録音日", kind: "date" },
          { key: "releaseDate", label: "公開日", kind: "date" },
        ],
      },
      {
        key: "appearances",
        label: "登場",
        readonly: true,
        columns: [
          { key: "type", label: "種別" },
          { key: "label", label: "リリース / イベント" },
          { key: "orderIndex", label: "#", kind: "number" },
        ],
      },
    ],
  },
  events: {
    title: "Events",
    singular: "イベント",
    description: "公演、会場、セットリスト",
    defaultSort: "eventDate",
    defaultDirection: "desc",
    columns: [
      { key: "eventDate", label: "日付", sortable: true, kind: "date" },
      { key: "eventName", label: "イベント", sortable: true },
      { key: "projectName", label: "プロジェクト", sortable: true },
      { key: "venueName", label: "会場", sortable: true },
      { key: "type", label: "種別" },
    ],
    fields: [
      {
        key: "projectId",
        label: "プロジェクト",
        type: "combobox",
        lookup: "project",
        required: true,
      },
      {
        key: "venueId",
        label: "会場",
        type: "combobox",
        lookup: "venue",
        required: true,
      },
      {
        key: "type",
        label: "種別",
        type: "select",
        required: true,
        options: [
          { value: "live", label: "Live" },
          { value: "exhibition", label: "Exhibition" },
          { value: "listening_event", label: "Listening event" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "eventName", label: "イベント名", type: "text" },
      { key: "eventDate", label: "開催日", type: "date", required: true },
      { key: "doorsOpenTime", label: "開場", type: "time" },
      { key: "startTime", label: "開始", type: "time" },
      { key: "endTime", label: "終了", type: "time" },
      { key: "ticketPrice", label: "料金", type: "number" },
      descriptionField,
      notesField,
    ],
    relations: [
      {
        key: "performances",
        label: "セットリスト",
        resource: "event-performances",
        parentField: "eventId",
        columns: [
          { key: "orderIndex", label: "#", kind: "number" },
          { key: "compositionTitle", label: "楽曲" },
          { key: "encore", label: "Encore", kind: "boolean" },
          { key: "variationNote", label: "バージョン", kind: "muted" },
        ],
      },
    ],
  },
  articles: {
    title: "Articles",
    singular: "記事",
    description: "掲載媒体、号、記事、参照対象",
    defaultSort: "publishedDate",
    defaultDirection: "desc",
    columns: [
      { key: "publishedDate", label: "公開日", sortable: true, kind: "date" },
      { key: "title", label: "タイトル", sortable: true },
      { key: "publicationName", label: "媒体", sortable: true },
      { key: "type", label: "種別" },
    ],
    fields: [
      {
        key: "publicationIssueId",
        label: "掲載号",
        type: "combobox",
        lookup: "publication-issue",
        span: 2,
      },
      { key: "title", label: "タイトル", type: "text", required: true, span: 2 },
      { key: "type", label: "種別", type: "text" },
      { key: "publishedDate", label: "公開日", type: "date" },
      { key: "url", label: "URL", type: "url", span: 2 },
      { key: "summary", label: "要約", type: "textarea", span: 2 },
      { key: "content", label: "本文", type: "textarea", span: 2 },
    ],
    relations: [
      {
        key: "issue",
        label: "掲載号",
        resource: "publication-issues",
        readonly: true,
        columns: [
          { key: "publicationName", label: "媒体" },
          { key: "issueNumber", label: "号" },
          { key: "volume", label: "巻" },
          { key: "publishedDate", label: "発行日", kind: "date" },
        ],
      },
      {
        key: "mentions",
        label: "参照",
        resource: "article-mentions",
        parentField: "articleId",
        columns: [
          { key: "targetType", label: "対象種別" },
          { key: "targetName", label: "対象" },
          { key: "mentionType", label: "参照種別" },
          { key: "notes", label: "メモ", kind: "muted" },
        ],
      },
    ],
  },
  contributions: {
    title: "Contributions",
    singular: "関与",
    description: "人物のリリース、録音、公演への関与",
    defaultSort: "personName",
    columns: [
      { key: "personName", label: "人物", sortable: true },
      { key: "roleName", label: "役割", sortable: true },
      { key: "instrumentName", label: "楽器" },
      { key: "targetType", label: "対象種別" },
      { key: "targetName", label: "対象", sortable: true },
    ],
    fields: [
      {
        key: "personId",
        label: "人物",
        type: "combobox",
        lookup: "person",
        required: true,
      },
      { key: "roleId", label: "役割", type: "combobox", lookup: "role", required: true },
      { key: "instrumentId", label: "楽器", type: "combobox", lookup: "instrument" },
      { key: "target", label: "対象", type: "target", required: true, span: 2 },
      notesField,
    ],
  },
};

export const editorConfigs: Record<EditorResource, ResourceConfig> = {
  ...resourceConfigs,
  memberships: {
    title: "Memberships",
    singular: "参加履歴",
    description: "",
    defaultSort: "fromDate",
    columns: [],
    fields: [
      { key: "personId", label: "人物", type: "combobox", lookup: "person", required: true },
      {
        key: "projectId",
        label: "プロジェクト",
        type: "combobox",
        lookup: "project",
        required: true,
      },
      { key: "fromDate", label: "開始日", type: "date", required: true },
      { key: "toDate", label: "終了日", type: "date" },
      {
        key: "fromDatePrecision",
        label: "開始日の精度",
        type: "select",
        options: precisionOptions,
      },
      {
        key: "toDatePrecision",
        label: "終了日の精度",
        type: "select",
        options: precisionOptions,
      },
      { key: "note", label: "メモ", type: "textarea", span: 2 },
    ],
  },
  "membership-roles": {
    title: "Membership roles",
    singular: "参加役割",
    description: "",
    defaultSort: "roleName",
    columns: [],
    fields: [
      {
        key: "membershipId",
        label: "参加履歴",
        type: "text",
        required: true,
        span: 2,
      },
      { key: "roleId", label: "役割", type: "combobox", lookup: "role", required: true },
      { key: "instrumentId", label: "楽器", type: "combobox", lookup: "instrument" },
    ],
  },
  releases: {
    title: "Releases",
    singular: "リリース",
    description: "",
    defaultSort: "releaseDate",
    columns: [],
    fields: [
      { key: "workId", label: "作品", type: "combobox", lookup: "work", required: true, span: 2 },
      { key: "format", label: "形式", type: "text", required: true },
      { key: "catalogNumber", label: "品番", type: "text" },
      { key: "releaseDate", label: "発売日", type: "date" },
      {
        key: "releaseDatePrecision",
        label: "発売日の精度",
        type: "select",
        options: precisionOptions,
      },
      { key: "recordedFrom", label: "録音開始", type: "date" },
      { key: "recordedTo", label: "録音終了", type: "date" },
      {
        key: "distributorId",
        label: "流通",
        type: "combobox",
        lookup: "distributor",
        span: 2,
      },
      descriptionField,
      notesField,
    ],
  },
  "label-relations": {
    title: "Release labels",
    singular: "ラベル紐付け",
    description: "",
    defaultSort: "labelName",
    columns: [],
    fields: [
      {
        key: "releaseId",
        label: "リリース",
        type: "combobox",
        lookup: "release",
        required: true,
      },
      { key: "labelId", label: "ラベル", type: "combobox", lookup: "label", required: true },
    ],
  },
  recordings: {
    title: "Recordings",
    singular: "録音",
    description: "",
    defaultSort: "compositionTitle",
    columns: [],
    fields: [
      {
        key: "compositionId",
        label: "楽曲",
        type: "combobox",
        lookup: "composition",
        required: true,
        span: 2,
      },
      { key: "recordingYear", label: "録音年", type: "number" },
      { key: "type", label: "種別", type: "text" },
      { key: "recordedDate", label: "録音日", type: "date" },
      { key: "recordedFrom", label: "録音開始", type: "date" },
      { key: "recordedTo", label: "録音終了", type: "date" },
      { key: "releaseDate", label: "公開日", type: "date" },
      notesField,
    ],
  },
  tracks: {
    title: "Tracks",
    singular: "収録曲",
    description: "",
    defaultSort: "releaseName",
    columns: [],
    fields: [
      {
        key: "releaseId",
        label: "リリース",
        type: "combobox",
        lookup: "release",
        required: true,
      },
      {
        key: "recordingId",
        label: "録音",
        type: "combobox",
        lookup: "recording",
        required: true,
      },
      { key: "trackNumber", label: "曲順", type: "number", required: true },
      { key: "recordedDate", label: "録音日", type: "date" },
      notesField,
    ],
  },
  "event-performances": {
    title: "Event performances",
    singular: "演奏曲",
    description: "",
    defaultSort: "orderIndex",
    columns: [],
    fields: [
      { key: "eventId", label: "イベント", type: "text", required: true, span: 2 },
      {
        key: "compositionId",
        label: "楽曲",
        type: "combobox",
        lookup: "composition",
        required: true,
      },
      { key: "orderIndex", label: "順番", type: "number", required: true },
      { key: "encore", label: "アンコール", type: "checkbox" },
      { key: "variationNote", label: "バージョン", type: "text" },
      notesField,
    ],
  },
  "publication-issues": {
    title: "Publication issues",
    singular: "掲載号",
    description: "",
    defaultSort: "publishedDate",
    columns: [],
    fields: [
      {
        key: "publicationId",
        label: "媒体",
        type: "combobox",
        lookup: "publication",
        required: true,
        span: 2,
      },
      { key: "issueNumber", label: "号", type: "text" },
      { key: "volume", label: "巻", type: "text" },
      { key: "publishedDate", label: "発行日", type: "date" },
      descriptionField,
    ],
  },
  "article-mentions": {
    title: "Article mentions",
    singular: "記事参照",
    description: "",
    defaultSort: "mentionType",
    columns: [],
    fields: [
      { key: "articleId", label: "記事", type: "text", required: true, span: 2 },
      { key: "target", label: "参照対象", type: "target", required: true, span: 2 },
      { key: "mentionType", label: "参照種別", type: "text", required: true },
      notesField,
    ],
  },
  venues: masterConfig("Venues", "会場", [
    { key: "name", label: "名前", type: "text", required: true },
    { key: "location", label: "所在地", type: "text" },
    descriptionField,
  ]),
  roles: masterConfig("Roles", "役割", [
    { key: "name", label: "名前", type: "text", required: true },
    { key: "category", label: "カテゴリ", type: "text", required: true },
    descriptionField,
  ]),
  instruments: masterConfig("Instruments", "楽器", [
    { key: "name", label: "名前", type: "text", required: true },
    descriptionField,
  ]),
  labels: masterConfig("Labels", "ラベル", [
    { key: "name", label: "名前", type: "text", required: true },
    descriptionField,
  ]),
  distributors: masterConfig("Distributors", "流通", [
    { key: "name", label: "名前", type: "text", required: true },
    descriptionField,
  ]),
  publications: masterConfig("Publications", "媒体", [
    { key: "name", label: "名前", type: "text", required: true },
    { key: "type", label: "種別", type: "text" },
    { key: "publisher", label: "発行元", type: "text" },
    descriptionField,
  ]),
};

export const masterResources: Array<{ resource: EditorResource; label: string }> = [
  { resource: "venues", label: "会場" },
  { resource: "roles", label: "役割" },
  { resource: "instruments", label: "楽器" },
  { resource: "labels", label: "ラベル" },
  { resource: "distributors", label: "流通" },
  { resource: "publications", label: "媒体" },
  { resource: "publication-issues", label: "掲載号" },
];

function masterConfig(title: string, singular: string, fields: FieldConfig[]): ResourceConfig {
  return {
    title,
    singular,
    description: "",
    defaultSort: "name",
    columns: [],
    fields,
  };
}
