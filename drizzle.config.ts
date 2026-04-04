import type { Config } from 'drizzle-kit'
import path from 'node:path'
import os from 'node:os'

export default {
  schema: './src/main/infrastructure/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    // Points to the same path Electron uses via app.getPath('userData')
    url: path.join(os.homedir(), 'Library', 'Application Support', 'Transcribro', 'transcribro.db'),
  },
} satisfies Config
