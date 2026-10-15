import { routingErrorBody } from './problem.ts'

import type { Context } from 'hono'

interface RegisteredRoute {
  readonly method: string
  readonly path: string
}

const matches = (pattern: string, path: string): boolean =>
  new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`).test(path)

/**
 * Réponses du routeur Symfony quand aucune route ne correspond : 405 avec l'en-tête Allow si le
 * chemin existe pour une autre méthode, 404 sinon. JSON simple, `Content-Type: application/json`.
 */
export const routingErrorResponse = (c: Context, routes: readonly RegisteredRoute[]): Response => {
  const path = new URL(c.req.url).pathname
  const allowed = [
    ...new Set(
      routes
        .filter((route) => route.method !== 'ALL' && matches(route.path, path))
        .map((route) => route.method),
    ),
  ]
  const target = `${c.req.method} ${c.req.url}`

  if (allowed.length === 0) {
    return c.json(routingErrorBody(404, `No route found for "${target}"`), 404)
  }
  const allow = allowed.join(', ')

  return c.json(
    routingErrorBody(405, `No route found for "${target}": Method Not Allowed (Allow: ${allow})`),
    405,
    { Allow: allow },
  )
}
