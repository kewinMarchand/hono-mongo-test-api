import { z } from 'zod'

export const EXPOSURES = ['soleil', 'mi-ombre', 'ombre'] as const
export const SIZES = ['S', 'M', 'L'] as const
export const DEFAULT_ITEMS_PER_PAGE = 12
export const MAX_ITEMS_PER_PAGE = 48
/** Borne le décalage de pagination dans les entiers sûrs : au-delà, la page est simplement vide. */
export const MAX_PAGE = 1_000_000

export const exposureSchema = z.enum(EXPOSURES)
export const sizeSchema = z.enum(SIZES)

export const categorySchema = z.object({
  slug: z.string(),
  name: z.string(),
  parent: z.string().nullable(),
  position: z.int(),
})

export const categoryNodeSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    parent: z
      .string()
      .nullable()
      .meta({ description: 'Slug de la catégorie parente, null à la racine.' }),
    get children(): z.ZodArray<typeof categoryNodeSchema> {
      return z.array(categoryNodeSchema)
    },
  })
  .meta({
    id: 'Category',
    description:
      "Renvoie l'arbre des catégories : les catégories racines, chacune avec ses enfants, triées par position.",
  })

export const productSchema = z
  .object({
    id: z.int(),
    slug: z.string(),
    name: z.string(),
    categorySlug: z.string(),
    price: z.int().meta({ description: 'Prix en centimes.' }),
    exposure: exposureSchema,
    size: sizeSchema,
    inStock: z.boolean(),
    image: z.int().meta({ description: 'Index du visuel partagé, de 1 à 12.' }),
  })
  .meta({ id: 'ProductItem' })

export const facetValueSchema = z
  .object({
    value: z.string(),
    count: z.int().meta({
      description:
        'Nombre de produits obtenus en ajoutant cette valeur aux filtres des autres facettes.',
    }),
  })
  .meta({ id: 'FacetValue' })

export const categoryFacetValueSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    count: z.int().meta({
      description: 'Nombre de produits de cette sous-catégorie qui respectent les autres filtres.',
    }),
  })
  .meta({ id: 'CategoryFacetValue' })

export const productFacetsSchema = z
  .object({
    exposure: z
      .array(facetValueSchema)
      .meta({ description: 'Toutes les expositions, y compris à 0.' }),
    size: z.array(facetValueSchema).meta({ description: 'Toutes les tailles, y compris à 0.' }),
    category: z.array(categoryFacetValueSchema).meta({
      description:
        'Sous-catégories directes de la catégorie filtrée (catégories racines sans filtre). Vide sur une feuille.',
    }),
  })
  .meta({ id: 'ProductFacets' })

export const productListSchema = z
  .object({
    items: z.array(productSchema),
    totalItems: z
      .int()
      .meta({ description: 'Nombre total de produits filtrés, toutes pages confondues.' }),
    page: z.int(),
    itemsPerPage: z.int(),
    totalPages: z.int().meta({ description: 'Nombre de pages, 0 si aucun résultat.' }),
    facets: productFacetsSchema,
  })
  .meta({
    id: 'ProductList',
    description:
      "Liste les produits du catalogue. Les filtres se combinent en ET, les valeurs d'une même facette en OU. Une valeur invalide (inconnue, non numérique, hors bornes) est ignorée et remplacée par la valeur par défaut.",
  })

export declare namespace Catalog {
  type Exposure = z.infer<typeof exposureSchema>
  type Size = z.infer<typeof sizeSchema>
  type Category = z.infer<typeof categorySchema>
  type CategoryNode = z.infer<typeof categoryNodeSchema>
  type Product = z.infer<typeof productSchema>
  type FacetValue = z.infer<typeof facetValueSchema>
  type CategoryFacetValue = z.infer<typeof categoryFacetValueSchema>
  type ProductList = z.infer<typeof productListSchema>
  type Sort = 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'

  /** Paramètres bruts de la requête, avant application des règles « valeur invalide ignorée ». */
  interface RawCriteria {
    readonly category: string | undefined
    readonly exposure: readonly string[]
    readonly size: readonly string[]
    readonly priceMin: string | undefined
    readonly priceMax: string | undefined
    readonly inStock: string | undefined
    readonly orderPrice: string | undefined
    readonly orderName: string | undefined
    readonly page: string | undefined
    readonly itemsPerPage: string | undefined
  }

  interface Criteria {
    readonly category: string | null
    readonly exposures: readonly Exposure[]
    readonly sizes: readonly Size[]
    readonly priceMin: number | null
    readonly priceMax: number | null
    readonly inStockOnly: boolean
    readonly sort: Sort | null
    readonly page: number
    readonly itemsPerPage: number
  }

  /** Requête passée au dépôt : la branche est résolue, les sous-catégories à compter connues. */
  interface SearchQuery {
    readonly branch: string | null
    readonly children: readonly string[]
    readonly exposures: readonly Exposure[]
    readonly sizes: readonly Size[]
    readonly priceMin: number | null
    readonly priceMax: number | null
    readonly inStockOnly: boolean
    readonly sort: Sort | null
    readonly skip: number
    readonly limit: number
  }

  interface SearchResult {
    readonly items: Product[]
    readonly totalItems: number
    readonly exposureCounts: Partial<Record<Exposure, number>>
    readonly sizeCounts: Partial<Record<Size, number>>
    readonly categoryCounts: Partial<Record<string, number>>
  }

  interface CategoryRepository {
    /** Toutes les catégories, triées par position. */
    findAll(): Promise<Category[]>
  }

  interface ProductRepository {
    search(query: SearchQuery): Promise<SearchResult>
  }
}
