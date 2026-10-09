import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'
import { scenario } from '#/shared/http/scenario.ts'
import { taskSchema } from '#/task/domain/Task.ts'
import type { Task } from '#/task/domain/Task.ts'

export const taskRoutes = (repository: Task.Repository, options: RouteOptions) =>
  new OpenAPIHono().openapi(
    createRoute({
      method: 'get',
      path: '/api/tasks',
      operationId: 'api_tasks_get_collection',
      tags: ['Task'],
      summary: 'Retrieves the collection of Task resources.',
      description: 'Retrieves the collection of Task resources.',
      middleware: [negotiateFormat(), scenario(options.scenarios, () => [])],
      responses: {
        200: {
          description: 'Task collection',
          content: { 'application/json': { schema: z.array(taskSchema) } },
        },
      },
    }),
    async (c) => c.json(await repository.findAll(), 200),
  )
