import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import { buildCategoryTree } from '#/catalog/domain/categoryTree.ts'
import { parseCriteria } from '#/catalog/domain/productCriteria.ts'
import { emptyProductList, searchProducts } from '#/catalog/domain/productSearch.ts'
import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { problemContent, errorSchema } from '#/shared/http/problemSchemas.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { categoryNodeContract, productListContract } from './contract.ts'
import { productQueryDocumentation, rawCriteriaFromQuery } from './productQuery.ts'

export interface CatalogRepositories {
  readonly categories: Catalog.CategoryRepository
  readonly products: Catalog.ProductRepository
}

export const catalogRoutes = (repositories: CatalogRepositories, options: RouteOptions) =>
  new OpenAPIHono()
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/categories',
        operationId: 'api_categories_get_collection',
        tags: ['Category'],
        summary: 'Retrieves the collection of Category resources.',
        description:
          "Renvoie l'arbre des catégories : les catégories racines, chacune avec ses enfants, triées par position.",
        middleware: [negotiateFormat(), scenario(options.scenarios, () => [])],
        responses: {
          200: {
            description: 'Category collection',
            content: { 'application/json': { schema: z.array(categoryNodeContract) } },
          },
        },
      }),
      async (c) => c.json(buildCategoryTree(await repositories.categories.findAll()), 200),
    )
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/products',
        operationId: 'api_products_get',
        tags: ['ProductList'],
        summary: 'Retrieves a ProductList resource.',
        description:
          "Liste les produits du catalogue. Les filtres se combinent en ET, les valeurs d'une même facette en OU. Une valeur invalide (inconnue, non numérique, hors bornes) est ignorée et remplacée par la valeur par défaut.",
        middleware: [negotiateFormat(), scenario(options.scenarios, emptyProductList)],
        request: { query: productQueryDocumentation },
        responses: {
          200: {
            description: 'ProductList resource',
            content: { 'application/json': { schema: productListContract } },
          },
          404: { description: 'Not found', content: problemContent(errorSchema) },
        },
      }),
      async (c) => {
        const criteria = parseCriteria(rawCriteriaFromQuery(new URL(c.req.url).search))
        const categories = await repositories.categories.findAll()

        return c.json(await searchProducts(criteria, categories, repositories.products), 200)
      },
    )
