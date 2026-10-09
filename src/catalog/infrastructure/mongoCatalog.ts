import type { Collection, Document, Filter, Sort } from 'mongodb'
import { z } from 'zod'

import { exposureSchema, sizeSchema } from '#/catalog/domain/Catalog.ts'
import type { Catalog } from '#/catalog/domain/Catalog.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'

const categoryDocumentSchema = z.object({
  _id: z.string().min(1),
  name: z.string().min(1),
  parent: z.string().nullable(),
  position: z.int().min(1),
})

const productDocumentSchema = z.object({
  _id: z.int().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  categorySlug: z.string().min(1),
  categoryPath: z.array(z.string()).min(1),
  price: z.int().min(0),
  exposure: exposureSchema,
  size: sizeSchema,
  inStock: z.boolean(),
  image: z.int().min(1).max(12),
})

export type CategoryDocument = z.infer<typeof categoryDocumentSchema>
export type ProductDocument = z.infer<typeof productDocumentSchema>

export const categoryCollection: CollectionDefinition<typeof categoryDocumentSchema> = {
  name: 'categories',
  schema: categoryDocumentSchema,
  indexes: [{ key: { parent: 1, position: 1 } }],
}

export const productCollection: CollectionDefinition<typeof productDocumentSchema> = {
  name: 'products',
  schema: productDocumentSchema,
  indexes: [
    { key: { slug: 1 }, unique: true },
    { key: { categoryPath: 1 } },
    { key: { categorySlug: 1 } },
    { key: { price: 1 } },
  ],
}

export class MongoCategoryRepository implements Catalog.CategoryRepository {
  private readonly collection: Collection<CategoryDocument>

  constructor(collection: Collection<CategoryDocument>) {
    this.collection = collection
  }

  async findAll(): Promise<Catalog.Category[]> {
    const documents = await this.collection.find({}, { sort: { position: 1 } }).toArray()

    return documents.map(({ _id, ...category }) => ({ slug: _id, ...category }))
  }
}

const SORTS: Record<Catalog.Sort | 'relevance', Sort> = {
  relevance: { _id: 1 },
  'price-asc': { price: 1, _id: 1 },
  'price-desc': { price: -1, _id: 1 },
  'name-asc': { name: 1, _id: 1 },
  'name-desc': { name: -1, _id: 1 },
}

const FRENCH_COLLATION = { locale: 'fr' }

const countResultSchema = z.array(z.object({ _id: z.string(), count: z.int() }))

const facetResultSchema = z.object({
  items: z.array(productDocumentSchema),
  total: z.array(z.object({ count: z.int() })),
  exposure: countResultSchema,
  size: countResultSchema,
  category: countResultSchema,
})

const countsByKey = (rows: z.infer<typeof countResultSchema>): Record<string, number> =>
  Object.fromEntries(rows.map(({ _id, count }) => [_id, count]))

const countBy = (field: string): Document[] => [
  { $group: { _id: `$${field}`, count: { $sum: 1 } } },
]

const toProduct = ({ _id, categoryPath, ...product }: ProductDocument): Catalog.Product => ({
  id: _id,
  ...product,
})

/**
 * Une seule agrégation : la branche est filtrée d'abord, puis `$facet` calcule la page, le
 * total et chaque compteur disjonctif avec ses propres filtres (tous sauf ceux de sa facette).
 */
export class MongoProductRepository implements Catalog.ProductRepository {
  private readonly collection: Collection<ProductDocument>

  constructor(collection: Collection<ProductDocument>) {
    this.collection = collection
  }

  async search(query: Catalog.SearchQuery): Promise<Catalog.SearchResult> {
    const branch: Filter<ProductDocument> =
      query.branch === null ? {} : { categoryPath: query.branch }
    const exposure: Filter<ProductDocument> =
      query.exposures.length === 0 ? {} : { exposure: { $in: [...query.exposures] } }
    const size: Filter<ProductDocument> =
      query.sizes.length === 0 ? {} : { size: { $in: [...query.sizes] } }
    const others: Filter<ProductDocument> = {
      ...(query.priceMin === null && query.priceMax === null
        ? {}
        : {
            price: {
              ...(query.priceMin === null ? {} : { $gte: query.priceMin }),
              ...(query.priceMax === null ? {} : { $lte: query.priceMax }),
            },
          }),
      ...(query.inStockOnly ? { inStock: true } : {}),
    }
    const all = { ...exposure, ...size, ...others }

    const pipeline: Document[] = [
      { $match: branch },
      {
        $facet: {
          items: [
            { $match: all },
            { $sort: SORTS[query.sort ?? 'relevance'] },
            { $skip: query.skip },
            { $limit: query.limit },
          ],
          total: [{ $match: all }, { $count: 'count' }],
          exposure: [{ $match: { ...size, ...others } }, ...countBy('exposure')],
          size: [{ $match: { ...exposure, ...others } }, ...countBy('size')],
          category: [
            { $match: all },
            { $unwind: '$categoryPath' },
            { $match: { categoryPath: { $in: [...query.children] } } },
            ...countBy('categoryPath'),
          ],
        },
      },
    ]

    const isNameSort = query.sort === 'name-asc' || query.sort === 'name-desc'
    const [raw] = await this.collection
      .aggregate(pipeline, isNameSort ? { collation: FRENCH_COLLATION } : {})
      .toArray()
    const result = facetResultSchema.parse(raw)

    return {
      items: result.items.map(toProduct),
      totalItems: result.total[0]?.count ?? 0,
      exposureCounts: countsByKey(result.exposure),
      sizeCounts: countsByKey(result.size),
      categoryCounts: countsByKey(result.category),
    }
  }
}
