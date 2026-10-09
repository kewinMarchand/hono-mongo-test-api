import { createMiddleware } from 'hono/factory'

export const SCENARIO_HEADER = 'X-Scenario'

export type Scenario = 'error' | 'empty'

export const parseScenario = (value: string | undefined): Scenario | null =>
  value === 'error' || value === 'empty' ? value : null

export class SimulatedServerError extends Error {
  constructor() {
    super("Erreur serveur simulée par l'en-tête X-Scenario: error.")
    this.name = 'SimulatedServerError'
  }
}

/**
 * Simule un état de l'API pour les tests des fronts. Désactivé en production :
 * l'en-tête n'a alors aucun effet. `emptyBody` absent : `empty` est ignoré (formulaire, documentation).
 */
export const scenario = (enabled: boolean, emptyBody?: () => object) =>
  createMiddleware(async (c, next) => {
    const current = enabled ? parseScenario(c.req.header(SCENARIO_HEADER)) : null
    if (current === 'error') {
      throw new SimulatedServerError()
    }
    if (current === 'empty' && emptyBody !== undefined) {
      return c.json(emptyBody())
    }
    await next()
  })
