import { describe, expect, it } from 'vitest'

import { negotiate, RESOURCE_FORMATS } from '#/shared/http/negotiation.ts'
import { errorFlavor } from '#/shared/http/problem.ts'

describe('negotiate', () => {
  it.each([
    ['application/json', 'application/json'],
    ['*/*', 'application/json'],
    ['application/*', 'application/json'],
    ['application/ld+json, application/json', 'application/json'],
    ['application/ld+json', 'application/ld+json'],
    ['APPLICATION/JSON', 'application/json'],
    ['application/json;q=0', 'application/json'],
  ])('%s choisit %s', (accept, expected) => {
    expect(negotiate(accept, RESOURCE_FORMATS)).toBe(expected)
  })

  it.each(['text/html', 'application/json; charset=utf-8', 'text/html;q=0.9, image/png'])(
    '%s ne correspond à aucun format',
    (accept) => {
      expect(negotiate(accept, RESOURCE_FORMATS)).toBeNull()
    },
  )
})

describe('errorFlavor', () => {
  it.each([
    [undefined, 'plain'],
    ['application/json', 'plain'],
    ['text/plain, application/json', 'plain'],
    ['application/json, */*;q=0.8', 'plain'],
    ['*/*', 'jsonld'],
    ['application/json, text/plain, */*', 'jsonld'],
    ['text/html', 'jsonld'],
  ])('Accept %s donne une erreur %s', (accept, expected) => {
    expect(errorFlavor(accept)).toBe(expected)
  })
})
