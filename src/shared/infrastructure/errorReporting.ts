import * as Sentry from '@sentry/node'
import type { ErrorEvent, NodeOptions } from '@sentry/node'

export interface ErrorReporter {
  capture(error: unknown, request: { readonly method: string; readonly path: string }): void
}

export interface ErrorReportingConfig {
  readonly GLITCHTIP_DSN: string | undefined
  readonly GLITCHTIP_ENVIRONMENT: string
}

export const NO_ERROR_REPORTING: ErrorReporter = { capture: () => undefined }

const withoutRequestBody = (event: ErrorEvent): ErrorEvent => {
  if (event.request !== undefined) {
    delete event.request.data
    delete event.request.cookies
  }

  return event
}

/**
 * Suivi des erreurs dans GlitchTip par le SDK Sentry (SPEC-COMMUNE, section 16). Sans
 * GLITCHTIP_DSN, le SDK n'est pas initialisé et rien n'est envoyé. Aucune donnée personnelle,
 * aucune trace de performance, aucun corps de requête : seuls la méthode et le chemin
 * accompagnent l'erreur. `transport` ne sert qu'aux tests, qui n'appellent aucune instance réelle.
 */
export const initErrorReporting = (
  config: ErrorReportingConfig,
  transport?: NodeOptions['transport'],
): ErrorReporter => {
  if (config.GLITCHTIP_DSN === undefined) {
    return NO_ERROR_REPORTING
  }

  Sentry.init({
    dsn: config.GLITCHTIP_DSN,
    environment: config.GLITCHTIP_ENVIRONMENT,
    // Sentry 11 remplace sendDefaultPii par dataCollection : tout est coupé, aucun corps de requête.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
    },
    tracesSampleRate: 0,
    defaultIntegrations: false,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.functionToStringIntegration(),
    ],
    beforeSend: withoutRequestBody,
    ...(transport === undefined ? {} : { transport }),
  })

  return {
    capture: (error, request) => {
      Sentry.withScope((scope) => {
        scope.setTag('http.method', request.method)
        scope.setContext('requête', { method: request.method, path: request.path })
        Sentry.captureException(error)
      })
    },
  }
}
