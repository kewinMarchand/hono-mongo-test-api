import type { Collection } from 'mongodb'
import { z } from 'zod'

import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Task } from '#/task/domain/Task.ts'

const taskDocumentSchema = z.object({
  _id: z.int().min(1),
  title: z.string().min(1),
  done: z.boolean(),
})

type TaskDocument = z.infer<typeof taskDocumentSchema>

export const taskCollection: CollectionDefinition<typeof taskDocumentSchema> = {
  name: 'tasks',
  schema: taskDocumentSchema,
  indexes: [],
}

export const taskFixtures: TaskDocument[] = [
  { _id: 1, title: 'Brancher la vraie API', done: false },
  { _id: 2, title: 'Générer les types OpenAPI', done: false },
  { _id: 3, title: 'Lancer make qa', done: true },
]

export class MongoTaskRepository implements Task.Repository {
  private readonly collection: Collection<TaskDocument>

  constructor(collection: Collection<TaskDocument>) {
    this.collection = collection
  }

  async findAll(): Promise<Task.Entity[]> {
    const documents = await this.collection.find({}, { sort: { _id: 1 } }).toArray()

    return documents.map(({ _id, title, done }) => ({ id: _id, title, done }))
  }
}
