import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

let _db: Db | null = null

/**
 * Return the singleton Drizzle DB instance.
 * Call initDb() once at app startup before using this.
 */
export function getDb(): Db {
  if (!_db) {
    throw new Error('Database not initialised — call initDb() first')
  }
  return _db
}

/**
 * Initialise (or re-initialise) the SQLite database connection.
 * Enables WAL mode and foreign key enforcement.
 * Pass `:memory:` for tests.
 */
export function initDb(dbPath: string): Db {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  _db = drizzle(sqlite, { schema })
  return _db
}

/** Reset the singleton — for use in tests only. */
export function resetDb(): void {
  _db = null
}
