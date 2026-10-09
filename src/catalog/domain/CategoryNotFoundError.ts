export class CategoryNotFoundError extends Error {
  constructor(slug: string) {
    super(`Catégorie introuvable : ${slug}`)
    this.name = 'CategoryNotFoundError'
  }
}
