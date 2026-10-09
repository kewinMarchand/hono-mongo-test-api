import { describe, expect, it } from 'vitest'

import { parsePhpQuery, readPhpParameter, urlDecode } from '#/shared/http/phpQuery.ts'

const values = (search: string, key: string): unknown => {
  const value = parsePhpQuery(search).get(key)
  return value instanceof Map ? Object.fromEntries(value) : value
}

describe('parsePhpQuery', () => {
  it('ajoute les valeurs des clés vides et indexe les clés nommées', () => {
    expect(values('exposure[]=ombre&exposure[]=soleil', 'exposure')).toEqual({
      0: 'ombre',
      1: 'soleil',
    })
    expect(values('size[a]=L&size[]=S', 'size')).toEqual({ a: 'L', 0: 'S' })
  })

  it('garde la dernière affectation, scalaire ou tableau', () => {
    expect(values('exposure[]=ombre&exposure=soleil', 'exposure')).toBe('soleil')
    expect(values('exposure=soleil&exposure[]=ombre', 'exposure')).toEqual({ 0: 'ombre' })
    expect(values('page=1&page=2', 'page')).toBe('2')
  })

  it('décode les crochets encodés, quelle que soit la casse, et le + en espace', () => {
    expect(values('exposure%5B%5D=ombre', 'exposure')).toEqual({ 0: 'ombre' })
    expect(values('exposure%5b%5d=ombre', 'exposure')).toEqual({ 0: 'ombre' })
    expect(values('exposure[]=mi+ombre', 'exposure')).toEqual({ 0: 'mi ombre' })
  })

  it('conserve le nom de base tel quel et ignore les crochets non fermés', () => {
    const query = parsePhpQuery('order.price=asc&Exposure[]=ombre&order[price=asc')
    expect([...query.keys()]).toEqual(['order.price', 'Exposure'])
  })

  it('lit un paramètre déclaré avec des crochets', () => {
    const query = parsePhpQuery('order[price]=asc&order[name][]=desc')
    expect(readPhpParameter(query, 'order[price]')).toBe('asc')
    expect(readPhpParameter(query, 'order[name]')).toBeInstanceOf(Map)
    expect(readPhpParameter(query, 'order[size]')).toBeUndefined()
  })
})

describe('urlDecode', () => {
  it('laisse intacte une séquence % invalide', () => {
    expect(urlDecode('100%25%zz')).toBe('100%%zz')
  })
})
