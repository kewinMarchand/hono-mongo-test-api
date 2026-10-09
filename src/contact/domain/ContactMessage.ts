import { z } from 'zod'

const NAME_MIN_LENGTH = 2
const MESSAGE_MIN_LENGTH = 10
const TEXT_MAX_LENGTH = 255
const MESSAGE_MAX_LENGTH = 5000

export const CONTACT_ERRORS = {
  name: 'Indiquez votre nom (2 caractères minimum).',
  email: 'Indiquez une adresse e-mail valide, par exemple nom@domaine.fr.',
  message: 'Votre message doit contenir au moins 10 caractères.',
} as const

export const CONTACT_TOO_LONG_ERRORS = {
  name: `Votre nom ne doit pas dépasser ${TEXT_MAX_LENGTH} caractères.`,
  email: `Votre adresse e-mail ne doit pas dépasser ${TEXT_MAX_LENGTH} caractères.`,
  message: `Votre message ne doit pas dépasser ${MESSAGE_MAX_LENGTH} caractères.`,
} as const

/** Codes des contraintes Symfony, renvoyés tels quels par API Platform dans `violations[].code`. */
export const CONSTRAINT_CODES = {
  notNull: 'ad32d13f-c3d4-423b-909a-857b961eb720',
  notBlank: 'c1051bb4-d103-4f74-8988-acbcafc7fdc3',
  tooShort: '9ff3fdc4-b214-49db-8718-39c315e33d45',
  tooLong: 'd94b19cc-114f-4f44-9cc4-4138e80a87b9',
  invalidEmail: 'bd79c0ab-ddba-46cc-a703-a7a4b08de310',
} as const

const HTML5_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+\\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

/** trim() de PHP : espaces, tabulations, retours à la ligne, NUL et tabulation verticale. */
export const phpTrim = (value: string): string =>
  value.replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g, '')

const codePointLength = (value: string): number => Array.from(value).length

export const contactMessageSchema = z
  .object({
    id: z.int().nullable().optional().meta({ readOnly: true }),
    name: z.string().nullable().meta({ minLength: NAME_MIN_LENGTH, maxLength: TEXT_MAX_LENGTH }),
    email: z.string().nullable().meta({ format: 'email', maxLength: TEXT_MAX_LENGTH }),
    message: z
      .string()
      .nullable()
      .meta({ minLength: MESSAGE_MIN_LENGTH, maxLength: MESSAGE_MAX_LENGTH }),
    receivedAt: z.iso.datetime({ offset: true }).nullable().optional().meta({ readOnly: true }),
  })
  .meta({
    id: 'ContactMessage',
    description:
      'Enregistre un message de contact. Répond 422 avec la liste des violations si un champ est invalide.',
  })

const writableText = z.string().nullable().optional()

const contactMessageInputSchema = z.object({
  name: writableText.meta({ minLength: NAME_MIN_LENGTH, maxLength: TEXT_MAX_LENGTH }),
  email: writableText.meta({ format: 'email', maxLength: TEXT_MAX_LENGTH }),
  message: writableText.meta({ minLength: MESSAGE_MIN_LENGTH, maxLength: MESSAGE_MAX_LENGTH }),
})

export declare namespace ContactMessage {
  type Input = z.infer<typeof contactMessageInputSchema>
  type Output = z.infer<typeof contactMessageSchema>

  interface Violation {
    readonly propertyPath: 'name' | 'email' | 'message'
    readonly message: string
    readonly code: string
  }

  interface Draft {
    readonly name: string
    readonly email: string
    readonly message: string
    readonly receivedAt: Date
  }

  interface Entity extends Draft {
    readonly id: number
  }

  interface Repository {
    save(draft: Draft): Promise<Entity>
  }
}

const lengthViolation = (
  propertyPath: ContactMessage.Violation['propertyPath'],
  value: string,
  minLength: number,
  maxLength: number,
): ContactMessage.Violation | null => {
  const length = codePointLength(value)
  if (length > maxLength) {
    return {
      propertyPath,
      message: CONTACT_TOO_LONG_ERRORS[propertyPath],
      code: CONSTRAINT_CODES.tooLong,
    }
  }
  if (length < minLength) {
    return { propertyPath, message: CONTACT_ERRORS[propertyPath], code: CONSTRAINT_CODES.tooShort }
  }

  return null
}

/**
 * Contraintes de ContactMessageResource côté API Platform, dans le même ordre :
 * name NotNull + Length(2..255, trim), email NotBlank + Email(html5) + Length(..255),
 * message NotNull + Length(10..5000, trim). Une valeur absente vaut null.
 */
export const contactMessageViolations = (
  input: ContactMessage.Input,
): ContactMessage.Violation[] => {
  const violations: (ContactMessage.Violation | null)[] = []
  const { name, email, message } = input

  if (name === null || name === undefined) {
    violations.push({
      propertyPath: 'name',
      message: CONTACT_ERRORS.name,
      code: CONSTRAINT_CODES.notNull,
    })
  } else {
    violations.push(lengthViolation('name', phpTrim(name), NAME_MIN_LENGTH, TEXT_MAX_LENGTH))
  }

  if (email === null || email === undefined || email === '') {
    violations.push({
      propertyPath: 'email',
      message: CONTACT_ERRORS.email,
      code: CONSTRAINT_CODES.notBlank,
    })
  } else {
    if (!HTML5_EMAIL.test(email)) {
      violations.push({
        propertyPath: 'email',
        message: CONTACT_ERRORS.email,
        code: CONSTRAINT_CODES.invalidEmail,
      })
    }
    if (codePointLength(email) > TEXT_MAX_LENGTH) {
      violations.push({
        propertyPath: 'email',
        message: CONTACT_TOO_LONG_ERRORS.email,
        code: CONSTRAINT_CODES.tooLong,
      })
    }
  }

  if (message === null || message === undefined) {
    violations.push({
      propertyPath: 'message',
      message: CONTACT_ERRORS.message,
      code: CONSTRAINT_CODES.notNull,
    })
  } else {
    violations.push(
      lengthViolation('message', phpTrim(message), MESSAGE_MIN_LENGTH, MESSAGE_MAX_LENGTH),
    )
  }

  return violations.filter((violation) => violation !== null)
}

/** Schéma du corps de la requête : la forme (chaîne ou null) puis les contraintes métier. */
export const contactMessageWriteSchema = contactMessageInputSchema.superRefine((input, context) => {
  for (const violation of contactMessageViolations(input)) {
    context.addIssue({
      code: 'custom',
      path: [violation.propertyPath],
      message: violation.message,
      params: { code: violation.code },
    })
  }
})

const CONTACT_FIELDS: readonly unknown[] = ['name', 'email', 'message']

const isContactField = (value: unknown): value is ContactMessage.Violation['propertyPath'] =>
  CONTACT_FIELDS.includes(value)

/** Relit les violations portées par les issues de contactMessageWriteSchema (null si autre erreur). */
export const violationsFromIssues = (
  issues: readonly z.core.$ZodIssue[],
): ContactMessage.Violation[] | null => {
  const violations = issues.flatMap((issue) => {
    const [field] = issue.path
    const code: unknown = issue.code === 'custom' ? issue.params?.['code'] : undefined
    return isContactField(field) && typeof code === 'string'
      ? [{ propertyPath: field, message: issue.message, code }]
      : []
  })

  return violations.length === issues.length ? violations : null
}

export const toDraft = (input: ContactMessage.Input, receivedAt: Date): ContactMessage.Draft => ({
  name: phpTrim(input.name ?? ''),
  email: phpTrim(input.email ?? ''),
  message: phpTrim(input.message ?? ''),
  receivedAt,
})
