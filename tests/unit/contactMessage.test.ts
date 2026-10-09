import { describe, expect, it } from 'vitest'

import {
  CONSTRAINT_CODES,
  CONTACT_ERRORS,
  CONTACT_TOO_LONG_ERRORS,
  contactMessageViolations,
  contactMessageWriteSchema,
  phpTrim,
  violationsFromIssues,
} from '#/contact/domain/ContactMessage.ts'
import { deserializationError } from '#/contact/http/deserializeContactMessage.ts'

describe('contactMessageViolations', () => {
  it('signale chaque champ absent avec NotNull ou NotBlank', () => {
    expect(contactMessageViolations({})).toEqual([
      { propertyPath: 'name', message: CONTACT_ERRORS.name, code: CONSTRAINT_CODES.notNull },
      { propertyPath: 'email', message: CONTACT_ERRORS.email, code: CONSTRAINT_CODES.notBlank },
      { propertyPath: 'message', message: CONTACT_ERRORS.message, code: CONSTRAINT_CODES.notNull },
    ])
  })

  it('mesure les longueurs après le trim de PHP, en points de code', () => {
    expect(
      contactMessageViolations({ name: ' A ', email: 'a@b.fr', message: '\t0123456789\n' }),
    ).toEqual([
      { propertyPath: 'name', message: CONTACT_ERRORS.name, code: CONSTRAINT_CODES.tooShort },
    ])
    expect(
      contactMessageViolations({ name: ' A ', email: 'a@b.fr', message: '😀'.repeat(10) }),
    ).toEqual([])
  })

  it('valide l’e-mail au format HTML5 avec domaine de premier niveau', () => {
    const codes = (email: string) =>
      contactMessageViolations({ name: 'Camille', email, message: 'Un message assez long.' }).map(
        (v) => v.code,
      )
    expect(codes('camille@example.fr')).toEqual([])
    expect(codes('a@b')).toEqual([CONSTRAINT_CODES.invalidEmail])
    expect(codes(' a@b.fr')).toEqual([CONSTRAINT_CODES.invalidEmail])
    expect(codes('')).toEqual([CONSTRAINT_CODES.notBlank])
  })

  it.each([
    ['name', { name: 'a'.repeat(256), email: 'a@b.fr', message: 'Un message assez long.' }],
    [
      'email',
      { name: 'Camille', email: `${'a'.repeat(251)}@b.fr`, message: 'Un message assez long.' },
    ],
    ['message', { name: 'Camille', email: 'a@b.fr', message: 'm'.repeat(5001) }],
  ] as const)('refuse un champ %s trop long avec un message français', (field, input) => {
    expect(contactMessageViolations(input)).toEqual([
      {
        propertyPath: field,
        message: CONTACT_TOO_LONG_ERRORS[field],
        code: CONSTRAINT_CODES.tooLong,
      },
    ])
  })

  it('accepte les longueurs maximales exactes', () => {
    expect(
      contactMessageViolations({
        name: 'a'.repeat(255),
        email: 'a@b.fr',
        message: 'm'.repeat(5000),
      }),
    ).toEqual([])
  })
})

describe('contactMessageWriteSchema', () => {
  it('porte les violations dans ses issues zod', () => {
    const result = contactMessageWriteSchema.safeParse({
      name: 'A',
      email: 'a@b.fr',
      message: 'Un message assez long.',
    })
    expect(result.success).toBe(false)
    expect(violationsFromIssues(result.error?.issues ?? [])).toEqual([
      { propertyPath: 'name', message: CONTACT_ERRORS.name, code: CONSTRAINT_CODES.tooShort },
    ])
  })
})

describe('phpTrim', () => {
  it('ne retire pas l’espace insécable', () => {
    expect(phpTrim(' \t x \n')).toBe(' x ')
  })
})

describe('deserializationError', () => {
  it.each([
    ['"abc"', 'Invalid IRI "abc".'],
    ['{"id":5,"name":"Cam"}', 'Update is not allowed for this operation.'],
    [
      '{"message":1,"name":true}',
      'The type of the "message" attribute must be "null|string", "integer" given.',
    ],
    ['{"name":1.5}', 'The type of the "name" attribute must be "null|string", "double" given.'],
    ['{"name":{}}', 'The type of the "name" attribute must be "null|string", "array" given.'],
  ])('%s', (body, expected) => {
    expect(deserializationError(JSON.parse(body))).toBe(expected)
  })

  it('accepte les objets et tableaux bien typés', () => {
    expect(deserializationError({ id: null, name: null, foo: 1 })).toBeNull()
    expect(deserializationError([])).toBeNull()
  })
})
