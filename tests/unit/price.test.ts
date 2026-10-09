import { describe, expect, it } from 'vitest'

import { InvalidPriceError, Price } from '#/catalog/domain/price.ts'

describe('Price', () => {
  it('se construit depuis des centimes et reste un nombre', () => {
    const price = Price.fromCents(3490)

    expect(price).toBe(3490)
    expect(JSON.stringify({ price })).toBe('{"price":3490}')
  })

  it.each([-1, 12.5, Number.NaN])('refuse %s centimes', (cents) => {
    expect(() => Price.fromCents(cents)).toThrow(InvalidPriceError)
  })
})
