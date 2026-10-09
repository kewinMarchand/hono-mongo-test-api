/**
 * Lecture d'une query string avec la sémantique PHP (parse_str), telle que la voit
 * API Platform : `a[]=x` ajoute, `a[k]=x` indexe, la dernière affectation gagne, une valeur
 * scalaire et un tableau du même nom s'écrasent l'un l'autre. Le nom de base est conservé
 * tel quel (API Platform le protège des remplacements `.` et espace de PHP), et `%5B` vaut `[`
 * quelle que soit sa casse (Symfony normalise la query string avant API Platform).
 */
export type PhpValue = string | PhpArray
export type PhpArray = Map<string, PhpValue>

const HEX = /^[0-9a-fA-F]{2}$/
const INTEGER_KEY = /^(0|-?[1-9]\d*)$/

export const urlDecode = (raw: string): string => {
  const bytes: number[] = []
  const encoder = new TextEncoder()
  for (let index = 0; index < raw.length; index++) {
    const char = raw.charAt(index)
    const hex = raw.slice(index + 1, index + 3)
    if (char === '%' && HEX.test(hex)) {
      bytes.push(Number.parseInt(hex, 16))
      index += 2
    } else {
      bytes.push(...encoder.encode(char === '+' ? ' ' : char))
    }
  }

  return new TextDecoder().decode(new Uint8Array(bytes))
}

type Segment = string | null

interface ParsedName {
  readonly base: string
  readonly path: readonly Segment[]
}

const parseName = (rawName: string): ParsedName | null => {
  const name = rawName.replace(/%5B/gi, '[')
  const bracket = name.indexOf('[')
  const base = urlDecode(bracket === -1 ? name : name.slice(0, bracket))
  if (base === '') {
    return null
  }
  if (bracket === -1) {
    return { base, path: [] }
  }

  const rest = urlDecode(name.slice(bracket))
  const path: Segment[] = []
  let index = 0
  while (rest.charAt(index) === '[') {
    const close = rest.indexOf(']', index + 1)
    if (close === -1) {
      if (path.length === 0) {
        return null
      }
      break
    }
    path.push(close === index + 1 ? null : rest.slice(index + 1, close))
    index = close + 1
  }

  return { base, path }
}

const nextIndex = (array: PhpArray): string => {
  let max = -1
  for (const key of array.keys()) {
    if (INTEGER_KEY.test(key)) {
      max = Math.max(max, Number(key))
    }
  }

  return String(max + 1)
}

const childArray = (parent: PhpArray, segment: Segment): PhpArray => {
  const key = segment ?? nextIndex(parent)
  const existing = segment === null ? undefined : parent.get(key)
  if (existing instanceof Map) {
    return existing
  }
  const created: PhpArray = new Map()
  parent.set(key, created)

  return created
}

export const parsePhpQuery = (search: string): PhpArray => {
  const root: PhpArray = new Map()
  const source = search.startsWith('?') ? search.slice(1) : search

  for (const pair of source.split('&')) {
    if (pair === '') {
      continue
    }
    const equals = pair.indexOf('=')
    const parsed = parseName(equals === -1 ? pair : pair.slice(0, equals))
    if (parsed === null) {
      continue
    }
    const value = equals === -1 ? '' : urlDecode(pair.slice(equals + 1))
    const { base, path } = parsed
    const last = path.at(-1)
    if (last === undefined) {
      root.set(base, value)
      continue
    }

    let container = childArray(root, base)
    for (const segment of path.slice(0, -1)) {
      container = childArray(container, segment)
    }
    container.set(last ?? nextIndex(container), value)
  }

  return root
}

/** Lit un paramètre déclaré avec des crochets, comme `order[price]`. */
export const readPhpParameter = (query: PhpArray, key: string): PhpValue | undefined => {
  const parsed = parseName(key)
  if (parsed === null) {
    return undefined
  }

  let value = query.get(parsed.base)
  for (const segment of parsed.path) {
    if (!(value instanceof Map) || segment === null) {
      return undefined
    }
    value = value.get(segment)
  }

  return value
}
