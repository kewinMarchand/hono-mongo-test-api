import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { constraintViolationSchema } from '#/shared/http/problemSchemas.ts'

import { CONTACT_ERRORS, contactMessageContract } from '#/contact/http/contract.ts'

import { createTestContext } from './context.ts'

import type { TestContext } from './context.ts'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext('contact')
})
afterAll(() => context.close())

const post = (body: string, headers: Record<string, string> = {}) =>
  context.app.request('/api/contact_messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body,
  })

describe('POST /api/contact_messages', () => {
  it('enregistre le message nettoyé et répond 201', async () => {
    const response = await post(
      JSON.stringify({
        name: '  Camille Martin ',
        email: 'camille.martin@example.fr',
        message: 'Bonjour, je souhaite un devis pour une refonte.',
      }),
    )
    const { receivedAt, ...saved } = contactMessageContract.parse(await response.json())

    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toBe('/api/contact_messages/1')
    expect(saved).toEqual({
      id: 1,
      name: 'Camille Martin',
      email: 'camille.martin@example.fr',
      message: 'Bonjour, je souhaite un devis pour une refonte.',
    })
    expect(receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/)

    const document = await context.db
      .collection<{ _id: number; name: string; receivedAt: Date }>('contact_messages')
      .findOne({ _id: 1 })
    expect(document?.name).toBe('Camille Martin')
    expect(document?.receivedAt).toBeInstanceOf(Date)
  })

  it.each([
    [
      'champs absents',
      '{}',
      { name: CONTACT_ERRORS.name, email: CONTACT_ERRORS.email, message: CONTACT_ERRORS.message },
    ],
    [
      'champs vides ou trop courts',
      '{"name":" A ","email":"","message":"  Court   "}',
      { name: CONTACT_ERRORS.name, email: CONTACT_ERRORS.email, message: CONTACT_ERRORS.message },
    ],
    [
      'e-mail invalide seul',
      '{"name":"Camille","email":"camille@","message":"Un message assez long."}',
      { email: CONTACT_ERRORS.email },
    ],
  ])('répond 422 en problem+json : %s', async (_case, payload, expected) => {
    const response = await post(payload)
    const body = constraintViolationSchema.parse(await response.json())

    expect(response.status).toBe(422)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(body).toMatchObject({ status: 422, title: 'An error occurred' })
    expect(
      Object.fromEntries(
        (body.violations ?? []).map(({ propertyPath, message }) => [propertyPath, message]),
      ),
    ).toEqual(expected)
  })

  it('répond 500 « Syntax error » sur un JSON invalide, comme API Platform', async () => {
    const response = await post('{bad')

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ detail: 'Syntax error' })
  })

  it('répond 413 en problem+json à un corps de plus de 64 Ko', async () => {
    const response = await post(
      JSON.stringify({ name: 'Camille', email: 'a@b.fr', message: 'm'.repeat(70000) }),
    )

    expect(response.status).toBe(413)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(await response.json()).toMatchObject({
      detail: 'Le corps de la requête ne doit pas dépasser 64 Ko.',
    })
  })

  it('répond 415 à un autre type de contenu', async () => {
    const response = await post('{}', { 'Content-Type': 'text/plain' })

    expect(response.status).toBe(415)
  })
})
