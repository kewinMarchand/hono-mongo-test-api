import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { API_CSP } from '#/shared/http/contentSecurityPolicy.ts'

import { createTestContext } from './context.ts'
import type { TestContext } from './context.ts'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext('csp')
})
afterAll(() => context.close())

describe('Content-Security-Policy', () => {
  it.each([
    ['une ressource', '/api/tasks', 200],
    ['une erreur', '/api/categories/inconnue', 404],
    ['une route inconnue', '/api/inconnue', 404],
  ])('est posé sur %s', async (_, path, status) => {
    const response = await context.app.request(path, { headers: { Accept: 'application/json' } })

    expect(response.status).toBe(status)
    expect(response.headers.get('content-security-policy')).toBe(API_CSP)
  })

  it("n'est pas posé sur la documentation HTML, qui charge ses scripts", async () => {
    const response = await context.app.request('/api/docs', { headers: { Accept: 'text/html' } })

    expect(response.headers.get('content-type')).toMatch(/^text\/html/)
    expect(response.headers.get('content-security-policy')).toBeNull()
  })
})
