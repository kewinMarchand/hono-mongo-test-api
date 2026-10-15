import { MongoClient } from 'mongodb'

import { toBsonSchema } from './bsonSchema.ts'

import type { Collection, Db, IndexDescription } from 'mongodb'
import type { z } from 'zod'

export interface CollectionDefinition<TSchema extends z.ZodObject = z.ZodObject> {
  readonly name: string
  readonly schema: TSchema
  readonly indexes: readonly IndexDescription[]
}

export const connectMongo = async (uri: string): Promise<MongoClient> => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
  await client.connect()

  return client
}

/**
 * Crée chaque collection avec son validateur `$jsonSchema` (généré depuis le schéma zod du
 * document) et ses index. Idempotent : une collection existante reçoit le validateur à jour.
 */
export const ensureCollections = async (
  db: Db,
  definitions: readonly CollectionDefinition[],
): Promise<void> => {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name),
  )

  for (const { name, schema, indexes } of definitions) {
    const validator = { $jsonSchema: toBsonSchema(schema) }
    if (existing.has(name)) {
      await db.command({ collMod: name, validator, validationLevel: 'strict' })
    } else {
      await db.createCollection(name, {
        validator,
        validationLevel: 'strict',
        validationAction: 'error',
      })
    }
    if (indexes.length > 0) {
      await db.collection(name).createIndexes([...indexes])
    }
  }
}

export const typedCollection = <TSchema extends z.ZodObject>(
  db: Db,
  definition: CollectionDefinition<TSchema>,
): Collection<z.infer<TSchema>> => db.collection<z.infer<TSchema>>(definition.name)
