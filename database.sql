-- ============================================================
-- EXTENSION
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- PERSON
-- ============================================================

CREATE TABLE person (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,

    birth_date DATE,
    death_date DATE,
    active_from DATE,
    active_to DATE,

    UNIQUE (name)
);

COMMENT ON TABLE person IS '個人（ミュージシャン、スタッフなど）';
COMMENT ON COLUMN person.name IS '表示名';
COMMENT ON COLUMN person.description IS '人物の説明';
COMMENT ON COLUMN person.birth_date IS '生年月日';
COMMENT ON COLUMN person.death_date IS '死亡日';
COMMENT ON COLUMN person.active_from IS '活動開始時期';
COMMENT ON COLUMN person.active_to IS '活動終了時期';

-- ============================================================
-- PROJECT
-- ============================================================

CREATE TABLE project (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    CHECK (end_date IS NULL OR end_date >= start_date),
    UNIQUE (name)
);

COMMENT ON TABLE project IS '活動単位（バンド、ソロ、ユニット）';
COMMENT ON COLUMN project.type IS '活動形態（band / solo 等）';

-- ============================================================
-- MEMBERSHIP
-- ============================================================

CREATE TABLE membership (
    id UUID PRIMARY KEY,
    person_id UUID NOT NULL REFERENCES person(id),
    project_id UUID NOT NULL REFERENCES project(id),

    from_date DATE NOT NULL,
    to_date DATE,
    from_date_precision TEXT,
    to_date_precision TEXT,

    support BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT,

    CHECK (to_date IS NULL OR to_date >= from_date),
    UNIQUE (person_id, project_id, from_date)
);

COMMENT ON TABLE membership IS 'プロジェクトへの参加期間';
COMMENT ON COLUMN membership.support IS 'サポートメンバーかどうか';

ALTER TABLE membership
ADD CONSTRAINT membership_no_overlap
EXCLUDE USING gist (
    person_id WITH =,
    project_id WITH =,
    daterange(from_date, COALESCE(to_date, 'infinity'::date), '[]') WITH &&
);

-- ============================================================
-- ROLE / INSTRUMENT
-- ============================================================

CREATE TABLE role (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    UNIQUE (name)
);

COMMENT ON TABLE role IS '役割（performer, producer など）';

CREATE TABLE instrument (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    UNIQUE (name)
);

COMMENT ON TABLE instrument IS '楽器';

CREATE TABLE membership_role (
    id UUID PRIMARY KEY,
    membership_id UUID NOT NULL REFERENCES membership(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES role(id),
    instrument_id UUID REFERENCES instrument(id),
    UNIQUE (membership_id, role_id, instrument_id)
);

COMMENT ON TABLE membership_role IS '参加期間中の役割';

-- ============================================================
-- WORK / RELEASE
-- ============================================================

CREATE TABLE work (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES project(id),
    title TEXT NOT NULL,
    description TEXT,
    created_date DATE,
    released_date DATE,
    UNIQUE (project_id, title)
);

COMMENT ON TABLE work IS '抽象作品（アルバム単位）';

CREATE TABLE distributor (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    UNIQUE (name)
);

CREATE TABLE release (
    id UUID PRIMARY KEY,
    work_id UUID NOT NULL REFERENCES work(id),
    format TEXT NOT NULL,
    catalog_number TEXT,
    release_date DATE,
    release_date_precision TEXT,
    recorded_from DATE,
    recorded_to DATE,
    description TEXT,
    notes TEXT,
    distributor_id UUID REFERENCES distributor(id),
    CHECK (recorded_to IS NULL OR recorded_to >= recorded_from),
    UNIQUE (work_id, format, release_date)
);

COMMENT ON TABLE release IS '具体リリース（CD, 配信など）';

-- ============================================================
-- LABEL
-- ============================================================

CREATE TABLE label (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    UNIQUE (name)
);

CREATE TABLE label_relation (
    id UUID PRIMARY KEY,
    release_id UUID NOT NULL REFERENCES release(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES label(id),
    UNIQUE (release_id, label_id)
);

-- ============================================================
-- COMPOSITION / RECORDING
-- ============================================================

CREATE TABLE composition (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    UNIQUE (title)
);

COMMENT ON TABLE composition IS '楽曲（抽象）';

CREATE TABLE recording (
    id UUID PRIMARY KEY,
    composition_id UUID NOT NULL REFERENCES composition(id),
    recording_year INT,
    type TEXT,
    recorded_date DATE,
    recorded_from DATE,
    recorded_to DATE,
    release_date DATE,
    notes TEXT,
    CHECK (recorded_to IS NULL OR recorded_to >= recorded_from)
);

COMMENT ON TABLE recording IS '録音単位（アレンジ・バージョン）';

CREATE TABLE track (
    id UUID PRIMARY KEY,
    release_id UUID NOT NULL REFERENCES release(id) ON DELETE CASCADE,
    recording_id UUID NOT NULL REFERENCES recording(id),
    track_number INT NOT NULL CHECK (track_number > 0),
    recorded_date DATE,
    notes TEXT,
    UNIQUE (release_id, track_number)
);

COMMENT ON TABLE track IS 'リリース内の曲順';

-- ============================================================
-- EVENT / VENUE
-- ============================================================

CREATE TABLE venue (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    description TEXT,
    UNIQUE (name, location)
);

CREATE TABLE event (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES project(id),
    venue_id UUID NOT NULL REFERENCES venue(id),
    type TEXT NOT NULL DEFAULT 'live',
    event_name TEXT,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    doors_open_time TIME,
    ticket_price INT,
    description TEXT,
    notes TEXT,
    UNIQUE (project_id, venue_id, event_date)
);

COMMENT ON TABLE event IS 'ライブ・公演';
COMMENT ON COLUMN event.type IS 'イベント種別（live / exhibition / listening_event 等）';

CREATE TABLE event_performance (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    composition_id UUID NOT NULL REFERENCES composition(id),
    order_index INT NOT NULL CHECK (order_index > 0),
    encore BOOLEAN NOT NULL DEFAULT FALSE,
    variation_note TEXT,
    notes TEXT,
    UNIQUE (event_id, order_index)
);

COMMENT ON TABLE event_performance IS 'セットリスト';

-- ============================================================
-- CONTRIBUTION
-- ============================================================

CREATE TABLE contribution (
    id UUID PRIMARY KEY,
    person_id UUID NOT NULL REFERENCES person(id),
    role_id UUID NOT NULL REFERENCES role(id),
    instrument_id UUID REFERENCES instrument(id),
    recording_id UUID REFERENCES recording(id),
    release_id UUID REFERENCES release(id),
    event_id UUID REFERENCES event(id),
    notes TEXT,
    CHECK (
        (recording_id IS NOT NULL)::int +
        (release_id IS NOT NULL)::int +
        (event_id IS NOT NULL)::int = 1
    )
);

COMMENT ON TABLE contribution IS '関与（誰が何にどの役割で関与したか）';

-- ============================================================
-- PUBLICATION（媒体）
-- ============================================================

CREATE TABLE publication (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT, -- magazine / web
    publisher TEXT,
    description TEXT,
    UNIQUE (name)
);

COMMENT ON TABLE publication IS '媒体（雑誌、ウェブサイト）';

-- ============================================================
-- PUBLICATION_ISSUE（号）
-- ============================================================

CREATE TABLE publication_issue (
    id UUID PRIMARY KEY,
    publication_id UUID NOT NULL REFERENCES publication(id),
    issue_number TEXT,
    volume TEXT,
    published_date DATE,
    description TEXT
);

COMMENT ON TABLE publication_issue IS '雑誌の号・巻';

-- ============================================================
-- ARTICLE
-- ============================================================

CREATE TABLE article (
    id UUID PRIMARY KEY,
    publication_issue_id UUID REFERENCES publication_issue(id),

    title TEXT NOT NULL,
    type TEXT,

    published_date DATE,
    summary TEXT,
    content TEXT,
    url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE article IS '記事（雑誌記事・Web記事）';

-- ============================================================
-- ARTICLE_MENTION
-- ============================================================

CREATE TABLE article_mention_work (
    id UUID PRIMARY KEY,
    article_id UUID NOT NULL REFERENCES article(id) ON DELETE CASCADE,
    work_id UUID NOT NULL REFERENCES work(id),
    mention_type TEXT NOT NULL,
    notes TEXT,
    UNIQUE (article_id, work_id, mention_type)
);

CREATE TABLE article_mention_event (
    id UUID PRIMARY KEY,
    article_id UUID NOT NULL REFERENCES article(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES event(id),
    mention_type TEXT NOT NULL,
    notes TEXT,
    UNIQUE (article_id, event_id, mention_type)
);

CREATE TABLE article_mention_person (
    id UUID PRIMARY KEY,
    article_id UUID NOT NULL REFERENCES article(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES person(id),
    mention_type TEXT NOT NULL,
    notes TEXT,
    UNIQUE (article_id, person_id, mention_type)
);
