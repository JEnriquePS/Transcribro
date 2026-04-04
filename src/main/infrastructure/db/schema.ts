import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const jobs = sqliteTable('jobs', {
  id:                    text('id').primaryKey(),
  originalFilename:      text('original_filename').notNull(),
  displayName:           text('display_name'),
  status:                text('status').notNull().default('pending'),
  model:                 text('model').notNull().default('large-v3'),
  language:              text('language').notNull().default('es'),
  threads:               integer('threads'),
  error:                 text('error'),
  progress:              real('progress').notNull().default(0),
  extractionProgress:    real('extraction_progress').notNull().default(0),
  transcriptionProgress: real('transcription_progress').notNull().default(0),
  formattingProgress:    real('formatting_progress').notNull().default(0),
  lastOffsetMs:          integer('last_offset_ms'),
  createdAt:             text('created_at'),
  startedAt:             text('started_at'),
  completedAt:           text('completed_at'),
  durationSeconds:       real('duration_seconds'),
})

export const transcriptSegments = sqliteTable('transcript_segments', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  jobId:     text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  start:     real('start').notNull(),
  end:       real('end').notNull(),
  text:      text('text').notNull(),
  isPartial: integer('is_partial', { mode: 'boolean' }).notNull().default(true),
})

export const transcriptResults = sqliteTable('transcript_results', {
  jobId:       text('job_id').primaryKey().references(() => jobs.id, { onDelete: 'cascade' }),
  model:       text('model').notNull(),
  language:    text('language').notNull(),
  fullText:    text('full_text').notNull(),
  enrichedJson: text('enriched_json'),
})
