import { createMiddleware } from 'hono/factory'

import { NotAcceptableError, UnsupportedMediaTypeError } from './httpErrors.ts'
import { negotiate, RESOURCE_FORMATS } from './negotiation.ts'

/**
 * Comme API Platform : une requête sans Accept reçoit du JSON, un Accept sans correspondance
 * reçoit 406. JSON-LD est accepté mais servi en JSON simple (voir README, différences).
 */
export const negotiateFormat = (formats: readonly string[] = RESOURCE_FORMATS) =>
  createMiddleware(async (c, next) => {
    const accept = c.req.header('Accept')
    if (accept !== undefined && accept !== '' && negotiate(accept, formats) === null) {
      throw new NotAcceptableError(accept, formats)
    }
    await next()
  })

export const requireJsonContentType = createMiddleware(async (c, next) => {
  const contentType = c.req.header('Content-Type') ?? ''
  const mime = contentType.split(';')[0]?.trim() ?? ''
  if (!RESOURCE_FORMATS.some((format) => format === mime)) {
    throw new UnsupportedMediaTypeError(contentType)
  }
  await next()
})
