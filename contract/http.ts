import { request } from 'node:http'

import type { ContractCase } from './cases.ts'

export interface RawResponse {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

/** node:http plutôt que fetch : fetch ajoute Accept et d'autres en-têtes que le contrat doit maîtriser. */
export const send = (baseUrl: string, contractCase: ContractCase): Promise<RawResponse> =>
  new Promise((resolve, reject) => {
    const url = new URL(baseUrl)
    const outgoing = request(
      {
        host: url.hostname,
        port: url.port,
        method: contractCase.method ?? 'GET',
        path: contractCase.path,
        headers: {
          ...contractCase.headers,
          ...(contractCase.body === undefined
            ? {}
            : { 'Content-Length': Buffer.byteLength(contractCase.body) }),
        },
      },
      (incoming) => {
        const chunks: Buffer[] = []
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk))
        incoming.on('end', () => {
          const headers: Record<string, string> = {}
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value !== undefined) {
              headers[name] = Array.isArray(value) ? value.join(', ') : value
            }
          }
          resolve({
            status: incoming.statusCode ?? 0,
            headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )
    outgoing.on('error', reject)
    if (contractCase.body !== undefined) {
      outgoing.write(contractCase.body)
    }
    outgoing.end()
  })
