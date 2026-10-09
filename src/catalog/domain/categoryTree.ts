import type { Catalog } from './Catalog.ts'
import { CategoryNotFoundError } from './CategoryNotFoundError.ts'

export const childrenOf = (
  categories: readonly Catalog.Category[],
  parent: string | null,
): Catalog.Category[] =>
  categories
    .filter((category) => category.parent === parent)
    .toSorted((a, b) => a.position - b.position)

export const buildCategoryTree = (
  categories: readonly Catalog.Category[],
  parent: string | null = null,
): Catalog.CategoryNode[] =>
  childrenOf(categories, parent).map((category) => ({
    slug: category.slug,
    name: category.name,
    parent: category.parent,
    children: buildCategoryTree(categories, category.slug),
  }))

export const findCategory = (
  categories: readonly Catalog.Category[],
  slug: string,
): Catalog.Category => {
  const category = categories.find((candidate) => candidate.slug === slug)
  if (category === undefined) {
    throw new CategoryNotFoundError(slug)
  }

  return category
}

/** Slugs de la racine jusqu'à la catégorie incluse : dénormalisé sur chaque produit. */
export const categoryPath = (categories: readonly Catalog.Category[], slug: string): string[] => {
  const path: string[] = []
  for (let current: string | null = slug; current !== null;) {
    const category = findCategory(categories, current)
    path.unshift(category.slug)
    current = category.parent
  }

  return path
}
