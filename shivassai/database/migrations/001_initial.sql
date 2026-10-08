-- shivassai initial schema (SQLite)

CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at  TEXT
);

CREATE TABLE IF NOT EXISTS projects (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    title              TEXT NOT NULL,
    slug               TEXT NOT NULL UNIQUE,
    short_description  TEXT NOT NULL DEFAULT '',
    description        TEXT NOT NULL DEFAULT '',   -- markdown, development story
    category           TEXT NOT NULL DEFAULT 'oyun',
    status             TEXT NOT NULL DEFAULT 'gelistiriliyor',
    cover_image        TEXT,
    gif                TEXT,
    video              TEXT,
    video_poster       TEXT,
    video_autoplay     INTEGER NOT NULL DEFAULT 1,
    ai_tools           TEXT NOT NULL DEFAULT '',   -- comma separated
    demo_url           TEXT NOT NULL DEFAULT '',
    github_url         TEXT NOT NULL DEFAULT '',
    created_on         TEXT,                       -- creation date (YYYY-MM-DD), optional
    story_idea         TEXT NOT NULL DEFAULT '',   -- markdown sections: "Nasıl yaptım?"
    story_prototype    TEXT NOT NULL DEFAULT '',
    story_problem      TEXT NOT NULL DEFAULT '',
    story_solution     TEXT NOT NULL DEFAULT '',
    story_ai           TEXT NOT NULL DEFAULT '',
    story_result       TEXT NOT NULL DEFAULT '',
    is_featured        INTEGER NOT NULL DEFAULT 0,
    is_published       INTEGER NOT NULL DEFAULT 0,
    sort_order         INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_published ON projects (is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects (is_featured, is_published);

CREATE TABLE IF NOT EXISTS project_technologies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_project_tech_project ON project_technologies (project_id);

-- Real, admin-supplied build metrics only. Nothing is seeded here.
CREATE TABLE IF NOT EXISTS project_metrics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    value       TEXT NOT NULL,
    context     TEXT NOT NULL DEFAULT '',
    note        TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_project_metrics_project ON project_metrics (project_id);

CREATE TABLE IF NOT EXISTS build_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    excerpt       TEXT NOT NULL DEFAULT '',
    body          TEXT NOT NULL DEFAULT '',   -- markdown
    project_id    INTEGER REFERENCES projects (id) ON DELETE SET NULL,
    cover_image   TEXT,
    published_at  TEXT,
    is_published  INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_build_logs_published ON build_logs (is_published, published_at);
CREATE INDEX IF NOT EXISTS idx_build_logs_project ON build_logs (project_id);

CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    slug  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS build_log_tags (
    build_log_id  INTEGER NOT NULL REFERENCES build_logs (id) ON DELETE CASCADE,
    tag_id        INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (build_log_id, tag_id)
);

CREATE TABLE IF NOT EXISTS media (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    path           TEXT NOT NULL UNIQUE,
    variant_path   TEXT,
    original_name  TEXT NOT NULL DEFAULT '',
    mime           TEXT NOT NULL,
    kind           TEXT NOT NULL,       -- image | gif | video
    size           INTEGER NOT NULL DEFAULT 0,
    width          INTEGER,
    height         INTEGER,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_kind ON media (kind);

CREATE TABLE IF NOT EXISTS settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS social_links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    platform    TEXT NOT NULL UNIQUE,   -- github | x | email
    url         TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contact_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    message     TEXT NOT NULL,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rate_limits (
    key_hash      TEXT PRIMARY KEY,
    hits          INTEGER NOT NULL DEFAULT 0,
    window_start  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS migrations (
    name        TEXT PRIMARY KEY,
    applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
