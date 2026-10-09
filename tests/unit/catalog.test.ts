import { describe, expect, it } from 'vitest'

import { CategoryNotFoundError } from '#/catalog/domain/CategoryNotFoundError.ts'
import {
  buildCategoryTree,
  categoryPath,
  childrenOf,
  findCategory,
} from '#/catalog/domain/categoryTree.ts'
import { emptyProductList, toProductList, toSearchQuery } from '#/catalog/domain/productSearch.ts'
import { parseCriteria } from '#/catalog/domain/productCriteria.ts'
import { rawCriteriaFromQuery } from '#/catalog/http/productQuery.ts'
import { categoryFixtures } from '#/catalog/infrastructure/catalogFixtures.ts'

describe('arbre des catégories', () => {
  it('construit 3 racines et 14 catégories', () => {
    const tree = buildCategoryTree(categoryFixtures)
    expect(tree.map((node) => node.slug)).toEqual([
      'plantes-interieur',
      'plantes-exterieur',
      'plantes-aquatiques',
    ])
    expect(tree[0]?.children[0]?.children.map((node) => node.slug)).toEqual([
      'monstera',
      'fougeres',
    ])
  })

  it('liste les enfants directs triés par position', () => {
    expect(childrenOf(categoryFixtures, 'feuillages').map((category) => category.slug)).toEqual([
      'monstera',
      'fougeres',
    ])
    expect(childrenOf(categoryFixtures, 'monstera')).toEqual([])
  })

  it('calcule le chemin depuis la racine', () => {
    expect(categoryPath(categoryFixtures, 'monstera')).toEqual([
      'plantes-interieur',
      'feuillages',
      'monstera',
    ])
  })

  it('lève CategoryNotFoundError avec le message français', () => {
    expect(() => findCategory(categoryFixtures, 'cactus')).toThrow(
      new CategoryNotFoundError('cactus'),
    )
    expect(() => findCategory(categoryFixtures, 'cactus')).toThrow('Catégorie introuvable : cactus')
  })
})

describe('liste de produits', () => {
  it('complète les facettes à 0 dans un ordre fixe et compte les pages', () => {
    const criteria = parseCriteria(rawCriteriaFromQuery('category=feuillages&itemsPerPage=5'))
    const children = childrenOf(categoryFixtures, 'feuillages')
    const list = toProductList(criteria, children, {
      items: [],
      totalItems: 6,
      exposureCounts: { ombre: 2, 'mi-ombre': 4 },
      sizeCounts: { L: 1 },
      categoryCounts: { fougeres: 3 },
    })

    expect(list.totalPages).toBe(2)
    expect(list.facets.exposure).toEqual([
      { value: 'soleil', count: 0 },
      { value: 'mi-ombre', count: 4 },
      { value: 'ombre', count: 2 },
    ])
    expect(list.facets.size.map((facet) => facet.count)).toEqual([0, 0, 1])
    expect(list.facets.category).toEqual([
      { slug: 'monstera', name: 'Monstera', count: 0 },
      { slug: 'fougeres', name: 'Fougères', count: 3 },
    ])
  })

  it('traduit la pagination en décalage', () => {
    const criteria = parseCriteria(rawCriteriaFromQuery('page=3&itemsPerPage=5'))
    expect(toSearchQuery(criteria, [])).toMatchObject({ skip: 10, limit: 5, branch: null })
  })

  it('a une forme vide pour X-Scenario: empty', () => {
    expect(emptyProductList()).toMatchObject({
      items: [],
      totalItems: 0,
      page: 1,
      itemsPerPage: 12,
      totalPages: 0,
    })
  })
})
