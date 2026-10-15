import { z } from 'zod'

import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Collection } from 'mongodb'

const contactMessageDocumentSchema = z.object({
  _id: z.int().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  message: z.string().min(1),
  receivedAt: z.date(),
})

const counterDocumentSchema = z.object({
  _id: z.string(),
  sequence: z.int().min(0),
})

type ContactMessageDocument = z.infer<typeof contactMessageDocumentSchema>
type CounterDocument = z.infer<typeof counterDocumentSchema>

export const contactMessageCollection: CollectionDefinition<typeof contactMessageDocumentSchema> = {
  name: 'contact_messages',
  schema: contactMessageDocumentSchema,
  indexes: [{ key: { receivedAt: -1 } }],
}

export const counterCollection: CollectionDefinition<typeof counterDocumentSchema> = {
  name: 'counters',
  schema: counterDocumentSchema,
  indexes: [],
}

/** Identifiant entier auto-incrémenté (comme la séquence PostgreSQL), via un compteur atomique. */
export class MongoContactMessageRepository implements ContactMessage.Repository {
  private readonly messages: Collection<ContactMessageDocument>
  private readonly counters: Collection<CounterDocument>

  constructor(messages: Collection<ContactMessageDocument>, counters: Collection<CounterDocument>) {
    this.messages = messages
    this.counters = counters
  }

  async save(draft: ContactMessage.Draft): Promise<ContactMessage.Entity> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: contactMessageCollection.name },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: 'after' },
    )
    const id = counter?.sequence ?? 1
    await this.messages.insertOne({ _id: id, ...draft })

    return { id, ...draft }
  }
}
