import { z } from 'zod'

export const articleContract = z
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
