import { z } from 'zod'

import { JSON_MIME, PROBLEM_MIME } from './negotiation.ts'

export const errorSchema = z
  .object({
    title: z.string().nullable().optional().meta({
      readOnly: true,
      description: 'A short, human-readable summary of the problem.',
    }),
    detail: z.string().nullable().optional().meta({
      readOnly: true,
      description: 'A human-readable explanation specific to this occurrence of the problem.',
    }),
    status: z
      .int()
      .nullable()
      .optional()
      .meta({ examples: [404], default: 400 }),
    instance: z.string().nullable().optional().meta({
      readOnly: true,
      description:
        'A URI reference that identifies the specific occurrence of the problem. It may or may not yield further information if dereferenced.',
    }),
    type: z
      .string()
      .optional()
      .meta({ readOnly: true, description: 'A URI reference that identifies the problem type' }),
  })
  .meta({ id: 'Error', description: 'A representation of common errors.' })

export const constraintViolationSchema = z
  .object({
    status: z.int().optional().meta({ default: 422 }),
    violations: z
      .array(
        z.object({
          propertyPath: z.string().meta({ description: 'The property path of the violation' }),
          message: z.string().meta({ description: 'The message associated with the violation' }),
          code: z.string().optional().meta({ description: 'The code of the violation' }),
          hint: z
            .string()
            .optional()
            .meta({ description: 'An extra hint to understand the violation' }),
          payload: z.record(z.string(), z.unknown()).optional().meta({
            additionalProperties: true,
            description: 'The serialized payload of the violation',
          }),
        }),
      )
      .optional(),
    detail: z.string().optional().meta({ readOnly: true }),
    type: z.string().optional().meta({ readOnly: true }),
    title: z.string().nullable().optional().meta({ readOnly: true }),
    instance: z.string().nullable().optional().meta({ readOnly: true }),
  })
  .meta({ id: 'ConstraintViolation', description: 'Unprocessable entity' })

export const problemContent = <TSchema extends z.ZodType>(schema: TSchema) => ({
  [PROBLEM_MIME]: { schema },
  [JSON_MIME]: { schema },
})
