import {
  DEFAULT_ITEMS_PER_PAGE,
  MAX_ITEMS_PER_PAGE,
  MAX_PAGE,
  exposureSchema,
  sizeSchema,
} from './Catalog.ts'
import type { Catalog } from './Catalog.ts'

const DIGITS = /^\d+$/

/** ctype_digit puis (int) de PHP : chiffres seulement, saturé au plus grand entier sûr. */
const toInteger = (value: string | undefined): number | null =>
  value !== undefined && DIGITS.test(value)
    ? Math.min(Number(value), Number.MAX_SAFE_INTEGER)
    : null

const toSort = (raw: Catalog.RawCriteria): Catalog.Sort | null => {
  if (raw.orderPrice === 'asc' || raw.orderPrice === 'desc') {
    return `price-${raw.orderPrice}`
  }
  if (raw.orderName === 'asc' || raw.orderName === 'desc') {
    return `name-${raw.orderName}`
  }

  return null
}

/** Applique les règles de l'URL des fronts : toute valeur invalide est ignorée, sans erreur. */
export const parseCriteria = (raw: Catalog.RawCriteria): Catalog.Criteria => {
  const itemsPerPage = toInteger(raw.itemsPerPage)

  return {
    category: raw.category === undefined || raw.category === '' ? null : raw.category,
    exposures: raw.exposure.flatMap((value) => {
      const parsed = exposureSchema.safeParse(value)
      return parsed.success ? [parsed.data] : []
    }),
    sizes: raw.size.flatMap((value) => {
      const parsed = sizeSchema.safeParse(value)
      return parsed.success ? [parsed.data] : []
    }),
    priceMin: toInteger(raw.priceMin),
    priceMax: toInteger(raw.priceMax),
    inStockOnly: raw.inStock === 'true' || raw.inStock === '1',
    sort: toSort(raw),
    page: Math.min(MAX_PAGE, Math.max(1, toInteger(raw.page) ?? 1)),
    itemsPerPage:
      itemsPerPage !== null && itemsPerPage >= 1 && itemsPerPage <= MAX_ITEMS_PER_PAGE
        ? itemsPerPage
        : DEFAULT_ITEMS_PER_PAGE,
  }
}
