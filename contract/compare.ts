import { isDeepStrictEqual } from 'node:util'

import { CASES } from './cases.ts'
import type { ContractCase } from './cases.ts'
import { send } from './http.ts'
import type { RawResponse } from './http.ts'
import { normalizeHeader, normalizeJson, parseJson } from './normalize.ts'
import { openApiShape } from './openapi.ts'

const REFERENCE = process.env['CONTRACT_REFERENCE_URL'] ?? 'http://localhost:8090'
const CANDIDATE = process.env['CONTRACT_CANDIDATE_URL'] ?? 'http://localhost:8091'
const ORIGINS = [REFERENCE, CANDIDATE]

interface Difference {
  readonly where: string
  readonly reference: unknown
  readonly candidate: unknown
}

const comparableBody = (response: RawResponse, contractCase: ContractCase): unknown => {
  const parsed = parseJson(response.body)
  if (!parsed.ok) {
    return response.body
  }
  const volatileId = contractCase.method === 'POST' && response.status === 201

  return normalizeJson(parsed.value, { origins: ORIGINS, volatileId })
}

const compareCase = (
  contractCase: ContractCase,
  reference: RawResponse,
  candidate: RawResponse,
): Difference[] => {
  const differences: Difference[] = []
  const check = (where: string, left: unknown, right: unknown): void => {
    if (!isDeepStrictEqual(left, right)) {
      differences.push({ where, reference: left, candidate: right })
    }
  }

  check('statut', reference.status, candidate.status)
  for (const header of ['content-type', ...(contractCase.compareHeaders ?? [])]) {
    check(
      `en-tête ${header}`,
      normalizeHeader(header, reference.headers[header]),
      normalizeHeader(header, candidate.headers[header]),
    )
  }
  check('corps', comparableBody(reference, contractCase), comparableBody(candidate, contractCase))

  return differences
}

/** Réponses documentées ici seulement, écarts assumés (README, « Écarts connus »). */
const OPENAPI_KNOWN_RESPONSES: Record<string, readonly string[]> = {
  'POST /api/contact_messages': ['413'],
}

const compareOpenApi = async (): Promise<Difference[]> => {
  const docs: ContractCase = {
    name: 'OpenAPI',
    path: '/api/docs.jsonopenapi',
    headers: { Accept: 'application/vnd.openapi+json' },
  }
  const [reference, candidate] = await Promise.all([send(REFERENCE, docs), send(CANDIDATE, docs)])
  const referenceShape = openApiShape(JSON.parse(reference.body))
  const candidateShape = openApiShape(JSON.parse(candidate.body), OPENAPI_KNOWN_RESPONSES)
  const keys = [...new Set([...Object.keys(referenceShape), ...Object.keys(candidateShape)])].sort()

  return [
    ...(reference.headers['content-type'] === candidate.headers['content-type']
      ? []
      : [
          {
            where: 'Content-Type',
            reference: reference.headers['content-type'],
            candidate: candidate.headers['content-type'],
          },
        ]),
    ...keys
      .filter((key) => !isDeepStrictEqual(referenceShape[key], candidateShape[key]))
      .map((key) => ({
        where: key,
        reference: referenceShape[key],
        candidate: candidateShape[key],
      })),
  ]
}

const print = (value: unknown): string =>
  value === undefined ? '(absent)' : JSON.stringify(value, null, 2)

let caseFailures = 0
let known = 0
for (const contractCase of CASES) {
  const [reference, candidate] = await Promise.all([
    send(REFERENCE, contractCase),
    send(CANDIDATE, contractCase),
  ])
  const differences = compareCase(contractCase, reference, candidate)
  if (differences.length === 0) {
    continue
  }
  if (contractCase.knownDifference !== undefined) {
    known++
    console.info(`ÉCART CONNU  ${contractCase.name} : ${contractCase.knownDifference}`)
    continue
  }
  caseFailures++
  console.error(`DIFFÉRENCE  ${contractCase.name}`)
  for (const difference of differences) {
    console.error(
      `  ${difference.where}\n    ${REFERENCE} : ${print(difference.reference)}\n    ${CANDIDATE} : ${print(difference.candidate)}`,
    )
  }
}

const openApiDifferences = await compareOpenApi()
for (const [operation, statuses] of Object.entries(OPENAPI_KNOWN_RESPONSES)) {
  console.info(
    `ÉCART CONNU  OpenAPI ${operation} : réponse ${statuses.join(', ')} documentée ici seulement.`,
  )
}
for (const difference of openApiDifferences) {
  console.error(
    `DIFFÉRENCE OpenAPI  ${difference.where}\n    ${REFERENCE} : ${print(difference.reference)}\n    ${CANDIDATE} : ${print(difference.candidate)}`,
  )
}

const identical = CASES.length - caseFailures - known
console.info(
  `\n${CASES.length} requêtes comparées : ${identical} identiques, ${known} écarts connus, ${caseFailures} différences. OpenAPI : ${openApiDifferences.length} différence(s).`,
)
process.exitCode = caseFailures === 0 && openApiDifferences.length === 0 ? 0 : 1
