import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { articleContract } from './contract.ts'

import type { Article } from '#/blog/domain/Article.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

export const articleRoutes = (repository: Article.Repository, options: RouteOptions) =>
  new OpenAPIHono().openapi(
    createRoute({
      method: 'get',
      path: '/api/articles',
      operationId: 'api_articles_get_collection',
      tags: ['Article'],
      summary: 'Retrieves the collection of Article resources.',
      description: 'Retrieves the collection of Article resources.',
      middleware: [negotiateFormat(), scenario(options.scenarios, () => [])],
      responses: {
        200: {
          description: 'Article collection',
          content: { 'application/json': { schema: z.array(articleContract) } },
        },
      },
    }),
    async (c) => c.json(await repository.findLatestFirst(), 200),
  )
