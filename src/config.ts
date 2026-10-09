import { z } from 'zod'

const DEFAULT_CORS_ALLOW_ORIGIN =
  '^http://localhost:(3000|3010|3100|3110|3120|3130|3150|3200|3210|3220|3230|3250|5173|8095)$'

const configSchema = z.object({
  APP_ENV: z.enum(['dev', 'test', 'prod']).default('dev'),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGODB_URI: z.string().min(1).default('mongodb://app:app@127.0.0.1:27017/?authSource=admin'),
  MONGODB_DB: z.string().min(1).default('app'),
  CORS_ALLOW_ORIGIN: z.string().min(1).default(DEFAULT_CORS_ALLOW_ORIGIN),
})

export type Config = z.infer<typeof configSchema>

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => configSchema.parse(env)
