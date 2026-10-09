import type { Db, MongoClient } from 'mongodb'

import { createApp } from '#/app.ts'
import type { AppConfig } from '#/app.ts'
import { loadConfig } from '#/config.ts'
import { createRepositories, resetDatabase } from '#/shared/infrastructure/database.ts'
import { connectMongo } from '#/shared/infrastructure/mongo.ts'

export interface TestContext {
  readonly app: ReturnType<typeof createApp>
  readonly db: Db
  readonly client: MongoClient
  readonly close: () => Promise<void>
}

/** Une base par fichier de test, recréée avec les fixtures : les fichiers tournent en parallèle. */
export const createTestContext = async (
  name: string,
  overrides: Partial<AppConfig> = {},
): Promise<TestContext> => {
  const config = loadConfig()
  const client = await connectMongo(config.MONGODB_URI)
  const db = client.db(`${config.MONGODB_DB}_${name}`)
  await resetDatabase(db)
  const app = createApp(createRepositories(db), { ...config, ...overrides })

  return {
    app,
    db,
    client,
    close: async () => {
      await db.dropDatabase()
      await client.close()
    },
  }
}

export const getJson = async (
  context: TestContext,
  path: string,
  headers: Record<string, string> = {},
) => {
  const response = await context.app.request(path, {
    headers: { Accept: 'application/json', ...headers },
  })
  const body: unknown = await response.json()

  return { response, body }
}
