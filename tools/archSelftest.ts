import { spawnSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'

/**
 * Auto-test des règles d'architecture (D6) : écrit chaque violation volontaire à son
 * emplacement réel, exige que ESLint échoue avec le message de la règle, puis retire le fichier.
 * Une règle débranchée ou mal écrite fait échouer `make qa`.
 */
interface Violation {
  readonly rule: string
  readonly file: string
  readonly source: string
  readonly expected: string
}

const VIOLATIONS: readonly Violation[] = [
  {
    rule: 'domaine vers infrastructure',
    file: 'src/catalog/domain/archSelftestViolation.ts',
    source: "export { MongoProductRepository } from '#/catalog/infrastructure/mongoCatalog.ts'\n",
    expected: "Couche domaine de catalog : n'importe que le domaine de son module",
  },
  {
    rule: 'domaine vers http par chemin relatif',
    file: 'src/contact/domain/archSelftestViolation.ts',
    source: "export { CONTACT_ERRORS } from '../http/contract.ts'\n",
    expected: "Import interne par l'alias #/",
  },
  {
    rule: 'domaine vers Hono',
    file: 'src/catalog/domain/archSelftestViolation.ts',
    source: "export { Hono } from 'hono'\n",
    expected: 'Hono est réservé à la couche http',
  },
  {
    rule: 'http vers infrastructure',
    file: 'src/catalog/http/archSelftestViolation.ts',
    source: "export { productFixtures } from '#/catalog/infrastructure/catalogFixtures.ts'\n",
    expected: 'Couche http de catalog : ni infrastructure, ni autre module',
  },
  {
    rule: 'module vers autre module',
    file: 'src/blog/http/archSelftestViolation.ts',
    source: "export { Price } from '#/catalog/domain/price.ts'\n",
    expected: 'Couche http de blog : ni infrastructure, ni autre module',
  },
  {
    rule: 'shared vers module',
    file: 'src/shared/http/archSelftestViolation.ts',
    source: "export { CategoryTree } from '#/catalog/domain/categoryTree.ts'\n",
    expected: 'shared/http ne dépend d’aucun module',
  },
]

let failures = 0
for (const violation of VIOLATIONS) {
  writeFileSync(violation.file, violation.source)
  try {
    const result = spawnSync('node_modules/.bin/eslint', ['--no-cache', violation.file], {
      encoding: 'utf8',
    })
    const output = `${result.stdout}${result.stderr}`
    if (result.status === 0) {
      failures++
      console.error(
        `ÉCHEC  ${violation.rule} : ESLint accepte la violation, la règle est débranchée.`,
      )
    } else if (!output.includes(violation.expected)) {
      failures++
      console.error(`ÉCHEC  ${violation.rule} : ESLint échoue pour une autre raison :\n${output}`)
    } else {
      console.info(`OK     ${violation.rule} : violation détectée.`)
    }
  } finally {
    rmSync(violation.file, { force: true })
  }
}

console.info(
  failures === 0
    ? `${VIOLATIONS.length} violations volontaires détectées, fichiers retirés.`
    : `${failures} règle(s) inopérante(s) sur ${VIOLATIONS.length}.`,
)
process.exitCode = failures === 0 ? 0 : 1
