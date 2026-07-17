import { randomBytes } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { folders } from '../db/schema'
import type { Db } from '../db/client'
import type { Folder } from '../../../shared/types'
import { FolderNotFoundError } from '../../domain/errors'

type FolderRow = typeof folders.$inferSelect

function rowToFolder(row: FolderRow): Folder {
  return {
    id:        row.id,
    name:      row.name,
    parentId:  row.parentId ?? null,
    createdAt: row.createdAt ?? null,
  }
}

export class DrizzleFolderRepository {
  constructor(private readonly db: Db) {}

  list(): Folder[] {
    return this.db
      .select()
      .from(folders)
      .orderBy(asc(folders.name))
      .all()
      .map(rowToFolder)
  }

  get(folderId: string): Folder | null {
    const row = this.db
      .select()
      .from(folders)
      .where(eq(folders.id, folderId))
      .get()
    return row ? rowToFolder(row) : null
  }

  create(name: string, parentId?: string | null): Folder {
    const id = randomBytes(16).toString('hex')
    const createdAt = new Date().toISOString()
    const parent = parentId ?? null
    this.db.insert(folders).values({ id, name, parentId: parent, createdAt }).run()
    return { id, name, parentId: parent, createdAt }
  }

  rename(folderId: string, name: string): Folder {
    const existing = this.get(folderId)
    if (!existing) throw new FolderNotFoundError(folderId)
    this.db.update(folders).set({ name }).where(eq(folders.id, folderId)).run()
    return { ...existing, name }
  }

  delete(folderId: string): void {
    // ON DELETE CASCADE removes subfolders recursively.
    // ON DELETE SET NULL on jobs.folder_id handles orphaning jobs automatically.
    this.db.delete(folders).where(eq(folders.id, folderId)).run()
  }
}
