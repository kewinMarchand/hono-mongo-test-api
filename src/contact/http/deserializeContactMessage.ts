import { createMiddleware } from 'hono/factory'

import { DeserializationError } from '#/shared/http/httpErrors.ts'

const WRITABLE_FIELDS = new Set(['name', 'email', 'message'])

/** Nom du type PHP (gettype) d'une valeur JSON décodée par json_decode. */
const phpType = (value: unknown): string => {
  if (value === null) {
    return 'NULL'
  }
  if (typeof value === 'boolean') {
    return 'boolean'
  }
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? 'integer' : 'double'
  }

  return typeof value === 'string' ? 'string' : 'array'
}

/**
 * Erreurs de désérialisation du serializer Symfony, que l'API Platform renvoie en 500 avant
 * toute validation : corps non objet, identifiant fourni sur une création, champ ni chaîne
 * ni null (le premier rencontré dans l'ordre du corps).
 */
export const deserializationError = (body: unknown): string | null => {
  if (typeof body === 'string') {
    return `Invalid IRI "${body}".`
  }
  if (typeof body !== 'object' || body === null) {
    return `The type of the "ContactMessage" resource must be "array" (nested document) or "string" (IRI), "${phpType(body)}" given.`
  }

  const entries = Object.entries(body)
  if (entries.some(([key, value]) => key === 'id' && value !== null)) {
    return 'Update is not allowed for this operation.'
  }
  const invalid = entries.find(
    ([key, value]) => WRITABLE_FIELDS.has(key) && value !== null && typeof value !== 'string',
  )

  return invalid === undefined
    ? null
    : `The type of the "${invalid[0]}" attribute must be "null|string", "${phpType(invalid[1])}" given.`
}

export const deserializeContactMessage = createMiddleware(async (c, next) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new DeserializationError('Syntax error')
  }
  const error = deserializationError(body)
  if (error !== null) {
    throw new DeserializationError(error)
  }
  await next()
})
