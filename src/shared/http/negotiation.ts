interface MediaRange {
  readonly type: string
  readonly subtype: string
  readonly quality: number
  readonly hasParameters: boolean
}

const parseMediaRange = (value: string): MediaRange | null => {
  const [mime = '', ...parameters] = value.split(';').map((part) => part.trim())
  const [type, subtype] = mime.toLowerCase().split('/')
  if (type === undefined || subtype === undefined || type === '' || subtype === '') {
    return null
  }

  let quality = 1
  let hasParameters = false
  for (const parameter of parameters) {
    const [name = '', rawValue = ''] = parameter.split('=').map((part) => part.trim())
    if (name.toLowerCase() === 'q') {
      const parsed = Number(rawValue)
      quality = Number.isFinite(parsed) ? parsed : 1
    } else if (name !== '') {
      hasParameters = true
    }
  }

  return { type, subtype, quality, hasParameters }
}

const specificity = (range: MediaRange, type: string, subtype: string): number | null => {
  if (range.hasParameters) {
    return null
  }
  const typeMatches = range.type === '*' || range.type === type
  const subtypeMatches = range.subtype === '*' || range.subtype === subtype
  if (!typeMatches || !subtypeMatches) {
    return null
  }

  return (range.type === type ? 100 : 0) + (range.subtype === subtype ? 10 : 0)
}

/**
 * Négociation à la manière de willdurand/negotiation (utilisée par API Platform) :
 * pour chaque type proposé, la plage la plus spécifique de l'en-tête donne sa qualité,
 * puis la meilleure qualité l'emporte, l'ordre des types proposés départageant les égalités.
 * Une plage qui porte des paramètres (hors q) ne correspond à aucun type proposé.
 */
export const negotiate = (accept: string, priorities: readonly string[]): string | null => {
  const ranges = accept
    .split(',')
    .map(parseMediaRange)
    .filter((range) => range !== null)

  let best: { priority: string; quality: number } | null = null
  for (const priority of priorities) {
    const [type = '', subtype = ''] = priority.split('/')
    let quality: number | null = null
    let bestScore = -1
    for (const range of ranges) {
      const score = specificity(range, type, subtype)
      if (score !== null && score > bestScore) {
        bestScore = score
        quality = range.quality
      }
    }
    if (quality !== null && (best === null || quality > best.quality)) {
      best = { priority, quality }
    }
  }

  return best?.priority ?? null
}

export const JSON_MIME = 'application/json'
export const JSONLD_MIME = 'application/ld+json'
export const PROBLEM_MIME = 'application/problem+json'
export const OPENAPI_MIME = 'application/vnd.openapi+json'

export const RESOURCE_FORMATS = [JSON_MIME, JSONLD_MIME] as const
