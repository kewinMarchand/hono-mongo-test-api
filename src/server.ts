import { serve } from '@hono/node-server'

import { createApp } from '#/app.ts'
import { loadConfig } from '#/config.ts'
import { createRepositories, ensureSchema } from '#/shared/infrastructure/database.ts'
import { connectMongo } from '#/shared/infrastructure/mongo.ts'

const config = loadConfig()
const client = await connectMongo(config.MONGODB_URI)
const db = client.db(config.MONGODB_DB)
await ensureSchema(db)

const server = serve(
  { fetch: createApp(createRepositories(db), config).fetch, port: config.PORT },
  (info) => {
    console.info(`API (${config.APP_ENV}) sur le port ${info.port}, base ${config.MONGODB_DB}`)
  },
)

const shutdown = (): void => {
  server.close(() => {
    void client.close().then(() => process.exit(0))
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
