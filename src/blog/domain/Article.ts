export declare namespace Article {
  interface Entity {
    readonly id: number
    readonly slug: string
    readonly title: string
    readonly excerpt: string
    /** Date de publication, sans heure : AAAA-MM-JJ. */
    readonly publishedAt: string
  }

  interface Repository {
    findLatestFirst(): Promise<Entity[]>
  }
}
