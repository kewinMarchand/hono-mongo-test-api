import { z } from 'zod'

type JsonObject = Record<string, unknown>

const BSON_DATE_MARKER = 'x-bson-type'

const BSON_TYPES: Record<string, readonly string[]> = {
  string: ['string'],
  boolean: ['bool'],
  object: ['object'],
  array: ['array'],
  null: ['null'],
  integer: ['int', 'long'],
  number: ['int', 'long', 'double', 'decimal'],
}

const KEPT_KEYWORDS = new Set([
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'pattern',
  'anyOf',
  'oneOf',
  'allOf',
])

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const bsonTypes = (type: unknown): string[] => {
  const types = Array.isArray(type) ? type : [type]

  return types.flatMap((name) => (typeof name === 'string' ? (BSON_TYPES[name] ?? []) : []))
}

const isSafeIntegerBound = (key: string, value: unknown): boolean =>
  (key === 'minimum' && value === Number.MIN_SAFE_INTEGER) ||
  (key === 'maximum' && value === Number.MAX_SAFE_INTEGER)

const convert = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    return node.map(convert)
  }
  if (!isObject(node)) {
    return node
  }

  const result: JsonObject = {}
  if (node[BSON_DATE_MARKER] === 'date') {
    result['bsonType'] = 'date'
  } else if (node['type'] !== undefined) {
    const types = bsonTypes(node['type'])
    result['bsonType'] = types.length === 1 ? types[0] : types
  }

  for (const [key, value] of Object.entries(node)) {
    if (!KEPT_KEYWORDS.has(key) || isSafeIntegerBound(key, value)) {
      continue
    }
    result[key] =
      key === 'properties' && isObject(value)
        ? Object.fromEntries(Object.entries(value).map(([name, child]) => [name, convert(child)]))
        : convert(value)
  }

  return result
}

/**
 * Traduit un schéma zod en validateur `$jsonSchema` MongoDB : JSON Schema draft 4 généré par
 * zod, puis réécrit dans le dialecte BSON (`bsonType` partout, `int`/`long` pour les entiers,
 * `date` pour z.date()), sans les mots-clés que MongoDB refuse (`$schema`, `format`, `default`).
 */
export const toBsonSchema = (schema: z.ZodType): JsonObject => {
  const jsonSchema = z.toJSONSchema(schema, {
    target: 'draft-04',
    io: 'output',
    unrepresentable: 'any',
    override: (context) => {
      if (context.zodSchema._zod.def.type === 'date') {
        context.jsonSchema[BSON_DATE_MARKER] = 'date'
      }
    },
  })
  const converted = convert(jsonSchema)

  return isObject(converted) ? converted : {}
}
