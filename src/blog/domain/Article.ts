import { z } from 'zod'

export const articleSchema = z
  .object({
    id: z.int(),
    slug: z.string(),
    title: z.string(),
    excerpt: z.string(),
    publishedAt: z.iso.date(),
  })
  .meta({
    id: 'Article',
    description: 'Liste les articles, du plus récent au plus ancien, sans pagination.',
  })

export declare namespace Article {
  type Entity = z.infer<typeof articleSchema>

  interface Repository {
    findLatestFirst(): Promise<Entity[]>
  }
}
