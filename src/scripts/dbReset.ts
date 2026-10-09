import { loadConfig } from '#/config.ts'
import { resetDatabase } from '#/shared/infrastructure/database.ts'
import { connectMongo } from '#/shared/infrastructure/mongo.ts'

const config = loadConfig()
const client = await connectMongo(config.MONGODB_URI)
try {
  await resetDatabase(client.db(config.MONGODB_DB))
  console.info(`Base ${config.MONGODB_DB} recréée avec les fixtures.`)
} finally {
  await client.close()
}
