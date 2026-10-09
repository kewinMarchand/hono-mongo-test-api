import type { Collection } from 'mongodb'
import { z } from 'zod'

import type { Article } from '#/blog/domain/Article.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'

const articleDocumentSchema = z.object({
  _id: z.int().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string(),
  publishedAt: z.date(),
})

type ArticleDocument = z.infer<typeof articleDocumentSchema>

export const articleCollection: CollectionDefinition<typeof articleDocumentSchema> = {
  name: 'articles',
  schema: articleDocumentSchema,
  indexes: [{ key: { slug: 1 }, unique: true }, { key: { publishedAt: -1, _id: -1 } }],
}

export const articleFixtures: ArticleDocument[] = [
  {
    _id: 1,
    slug: 'pourquoi-rendre-le-contenu-cote-serveur',
    title: 'Pourquoi rendre le contenu côté serveur',
    excerpt: 'Le contenu éditorial arrive dans le HTML initial : meilleur référencement et LCP.',
    publishedAt: new Date('2026-09-15T00:00:00Z'),
  },
  {
    _id: 2,
    slug: 'un-carrousel-accessible-sans-dependance',
    title: 'Un carrousel accessible sans dépendance',
    excerpt: 'Défilement natif, boutons explicites, pas de lecture automatique.',
    publishedAt: new Date('2026-09-22T00:00:00Z'),
  },
  {
    _id: 3,
    slug: 'le-mode-accessibilite-renforcee',
    title: 'Le mode accessibilité renforcée',
    excerpt: 'Texte agrandi, espacements WCAG 1.4.12 et contraste AAA, sans logique dupliquée.',
    publishedAt: new Date('2026-10-01T00:00:00Z'),
  },
]

export class MongoArticleRepository implements Article.Repository {
  private readonly collection: Collection<ArticleDocument>

  constructor(collection: Collection<ArticleDocument>) {
    this.collection = collection
  }

  async findLatestFirst(): Promise<Article.Entity[]> {
    const documents = await this.collection
      .find({}, { sort: { publishedAt: -1, _id: -1 } })
      .toArray()

    return documents.map(({ _id, publishedAt, ...article }) => ({
      id: _id,
      ...article,
      publishedAt: publishedAt.toISOString().slice(0, 10),
    }))
  }
}
