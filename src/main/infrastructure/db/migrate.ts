import { sql } from 'drizzle-orm'
import type { Db } from './client'

/**
 * Create all tables if they do not exist.
 * Runs as a no-op after the first call (idempotent CREATE TABLE IF NOT EXISTS).
 *
 * This is intentionally simple — no Drizzle Kit migrations at runtime.
 * Drizzle Kit is used only for generating SQL during development.
 */
export function runMigrations(db: Db): void {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id                     TEXT PRIMARY KEY,
      original_filename      TEXT NOT NULL,
      display_name           TEXT,
      status                 TEXT NOT NULL DEFAULT 'pending',
      model                  TEXT NOT NULL DEFAULT 'large-v3',
      language               TEXT NOT NULL DEFAULT 'es',
      threads                INTEGER,
      error                  TEXT,
      progress               REAL NOT NULL DEFAULT 0,
      extraction_progress    REAL NOT NULL DEFAULT 0,
      transcription_progress REAL NOT NULL DEFAULT 0,
      formatting_progress    REAL NOT NULL DEFAULT 0,
      last_offset_ms         INTEGER,
      created_at             TEXT,
      started_at             TEXT,
      completed_at           TEXT,
      duration_seconds       REAL
    )
  `)

  db.run(sql`
    CREATE TABLE IF NOT EXISTS transcript_segments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id     TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      start      REAL NOT NULL,
      end        REAL NOT NULL,
      text       TEXT NOT NULL,
      is_partial INTEGER NOT NULL DEFAULT 1
    )
  `)

  // Folders table (must be created before the folder_id column is added to jobs)
  db.run(sql`
    CREATE TABLE IF NOT EXISTS folders (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TEXT
    )
  `)

  // Idempotent: add folder_id to jobs if not already present
  // (SQLite does not support ADD COLUMN IF NOT EXISTS)
  const jobsCols = db.all(sql`PRAGMA table_info(jobs)`) as Array<{ name: string }>
  if (!jobsCols.some((c) => c.name === 'folder_id')) {
    db.run(sql`ALTER TABLE jobs ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL`)
  }

  // Idempotent: add parent_id to folders for subfolder support
  const folderCols = db.all(sql`PRAGMA table_info(folders)`) as Array<{ name: string }>
  if (!folderCols.some((c) => c.name === 'parent_id')) {
    db.run(sql`ALTER TABLE folders ADD COLUMN parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE`)
  }

  db.run(sql`
    CREATE TABLE IF NOT EXISTS transcript_results (
      job_id        TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
      model         TEXT NOT NULL,
      language      TEXT NOT NULL,
      full_text     TEXT NOT NULL,
      enriched_json TEXT
    )
  `)
}
