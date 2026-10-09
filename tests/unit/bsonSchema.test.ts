import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { toBsonSchema } from '#/shared/infrastructure/bsonSchema.ts'

describe('toBsonSchema', () => {
  it('traduit un schéma zod dans le dialecte $jsonSchema de MongoDB', () => {
    const schema = z.object({
      _id: z.int().min(1),
      name: z.string().min(1),
      parent: z.string().nullable(),
      tags: z.array(z.string()),
      size: z.enum(['S', 'M']),
      inStock: z.boolean(),
      price: z.number(),
      receivedAt: z.date(),
    })

    expect(toBsonSchema(schema)).toEqual({
      bsonType: 'object',
      properties: {
        _id: { bsonType: ['int', 'long'], minimum: 1 },
        name: { bsonType: 'string', minLength: 1 },
        parent: { bsonType: ['string', 'null'] },
        tags: { bsonType: 'array', items: { bsonType: 'string' } },
        size: { bsonType: 'string', enum: ['S', 'M'] },
        inStock: { bsonType: 'bool' },
        price: { bsonType: ['int', 'long', 'double', 'decimal'] },
        receivedAt: { bsonType: 'date' },
      },
      required: ['_id', 'name', 'parent', 'tags', 'size', 'inStock', 'price', 'receivedAt'],
      additionalProperties: false,
    })
  })
})
