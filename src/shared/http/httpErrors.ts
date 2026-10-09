import { RESOURCE_FORMATS } from './negotiation.ts'

const supported = (formats: readonly string[]): string =>
  formats.map((format) => `"${format}"`).join(', ')

export class NotAcceptableError extends Error {
  constructor(accept: string, formats: readonly string[]) {
    super(
      `Requested format "${accept}" is not supported. Supported MIME types are ${supported(formats)}.`,
    )
    this.name = 'NotAcceptableError'
  }
}

export class UnsupportedMediaTypeError extends Error {
  constructor(contentType: string) {
    super(
      `The content-type "${contentType}" is not supported. Supported MIME types are ${supported(RESOURCE_FORMATS)}.`,
    )
    this.name = 'UnsupportedMediaTypeError'
  }
}

export class NotExposedError extends Error {
  constructor() {
    super('This route does not aim to be called.')
    this.name = 'NotExposedError'
  }
}

export class PayloadTooLargeError extends Error {
  constructor(maxKilobytes: number) {
    super(`Le corps de la requête ne doit pas dépasser ${maxKilobytes} Ko.`)
    this.name = 'PayloadTooLargeError'
  }
}

export class DeserializationError extends Error {
  constructor(detail: string) {
    super(detail)
    this.name = 'DeserializationError'
  }
}
