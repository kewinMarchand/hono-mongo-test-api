import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import type { Article } from '#/blog/domain/Article.ts'
import { articleRoutes } from '#/blog/http/articleRoutes.ts'
import { CategoryNotFoundError } from '#/catalog/domain/CategoryNotFoundError.ts'
import { catalogRoutes } from '#/catalog/http/catalogRoutes.ts'
import type { CatalogRepositories } from '#/catalog/http/catalogRoutes.ts'
import type { Config } from '#/config.ts'
import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'
import { ContactMessageValidationError } from '#/contact/domain/ContactMessageValidationError.ts'
import { contactMessageRoutes } from '#/contact/http/contactMessageRoutes.ts'
import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { cors } from '#/shared/http/cors.ts'
import {
  DeserializationError,
  NotAcceptableError,
  NotExposedError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from '#/shared/http/httpErrors.ts'
import { OPENAPI_MIME, PROBLEM_MIME, negotiate } from '#/shared/http/negotiation.ts'
import { openApiDocument } from '#/shared/http/openapiDocument.ts'
import { errorFlavor, problemBody, violationsBody } from '#/shared/http/problem.ts'
import { routingErrorResponse } from '#/shared/http/routingErrors.ts'
import { SimulatedServerError, scenario } from '#/shared/http/scenario.ts'
import type { Task } from '#/task/domain/Task.ts'
import { taskRoutes } from '#/task/http/taskRoutes.ts'

export interface AppDependencies extends CatalogRepositories {
  readonly tasks: Task.Repository
  readonly articles: Article.Repository
  readonly contactMessages: ContactMessage.Repository
}

export type AppConfig = Pick<Config, 'APP_ENV' | 'CORS_ALLOW_ORIGIN'>

/** Ressources dont API Platform déclare l'item (pour générer les IRI) sans l'exposer. */
const NOT_EXPOSED_ITEMS = [
  '/api/tasks/:id',
  '/api/articles/:id',
  '/api/categories/:slug',
  '/api/contact_messages/:id',
]

const statusOf = (error: unknown): ContentfulStatusCode => {
  if (error instanceof CategoryNotFoundError || error instanceof NotExposedError) {
    return 404
  }
  if (error instanceof NotAcceptableError) {
    return 406
  }
  if (error instanceof PayloadTooLargeError) {
    return 413
  }
  if (error instanceof UnsupportedMediaTypeError) {
    return 415
  }
  if (error instanceof HTTPException) {
    return error.status
  }

  return 500
}

const isExpected = (error: unknown): boolean =>
  error instanceof SimulatedServerError ||
  error instanceof DeserializationError ||
  statusOf(error) < 500

export const createApp = (dependencies: AppDependencies, config: AppConfig) => {
  const options = { scenarios: config.APP_ENV !== 'prod' }
  const app = new OpenAPIHono()

  app.use('/api/*', cors(config.CORS_ALLOW_ORIGIN))

  const routes = app
    .route('/', taskRoutes(dependencies.tasks, options))
    .route('/', articleRoutes(dependencies.articles, options))
    .route('/', contactMessageRoutes(dependencies.contactMessages, options))
    .route('/', catalogRoutes(dependencies, options))

  for (const path of NOT_EXPOSED_ITEMS) {
    app.get(path, negotiateFormat(), () => {
      throw new NotExposedError()
    })
  }

  const docsMiddleware = [negotiateFormat([OPENAPI_MIME]), scenario(options.scenarios)] as const
  app.get('/api/docs.jsonopenapi', ...docsMiddleware, (c) =>
    c.body(JSON.stringify(openApiDocument(app)), 200, { 'Content-Type': OPENAPI_MIME }),
  )
  app.get('/api/docs', scenario(options.scenarios), async (c, next) => {
    const accept = c.req.header('Accept') ?? ''
    if (negotiate(accept, [OPENAPI_MIME, 'text/html']) === 'text/html') {
      return swaggerUI({ url: '/api/docs.jsonopenapi', title: 'API de test Kewin' })(c, next)
    }

    return c.body(JSON.stringify(openApiDocument(app)), 200, { 'Content-Type': OPENAPI_MIME })
  })

  app.notFound((c) => routingErrorResponse(c, app.routes))

  app.onError((error, c) => {
    const flavor = errorFlavor(c.req.header('Accept'))
    const headers = { 'Content-Type': PROBLEM_MIME }

    if (error instanceof ContactMessageValidationError) {
      return c.json(violationsBody(flavor, error.violations), 422, headers)
    }

    const status = statusOf(error)
    if (!isExpected(error)) {
      console.error(error)
    }
    const detail =
      status >= 500 && config.APP_ENV === 'prod' ? 'Internal Server Error' : error.message

    return c.json(problemBody(flavor, status, detail), status, headers)
  })

  return routes
}

export type AppType = ReturnType<typeof createApp>
