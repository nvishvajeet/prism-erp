-- === INSIGHTS MODULE SCHEMA ===
-- User-behavior telemetry — append-only, bounded retention.
-- Added by agent claude-opus-4.6-insights on 2026-04-15.
--
-- Scope:
--   telemetry_page_time — active seconds per (user, path, session)
--   telemetry_click     — click events by data-action attribute
--
-- Privacy:
--   NO raw mouse coordinates, NO keystrokes, NO cross-session fingerprinting.
--   session_id is a client-generated UUID for the browser tab only.
--
-- Retention: purge rows older than 90 days via scheduled task (phase 2).

CREATE TABLE IF NOT EXISTS telemetry_page_time (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    session_id   TEXT    NOT NULL,
    path         TEXT    NOT NULL,
    active_ms    INTEGER NOT NULL,
    started_at   TEXT    NOT NULL,
    ended_at     TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tpt_path ON telemetry_page_time(path, created_at);
CREATE INDEX IF NOT EXISTS idx_tpt_user ON telemetry_page_time(user_id, created_at);

CREATE TABLE IF NOT EXISTS telemetry_click (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    session_id   TEXT    NOT NULL,
    path         TEXT    NOT NULL,
    action       TEXT    NOT NULL,
    clicked_at   TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tc_action ON telemetry_click(action, created_at);
CREATE INDEX IF NOT EXISTS idx_tc_user   ON telemetry_click(user_id, created_at);
