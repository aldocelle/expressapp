import { normalizeTender } from './domain.mjs'

export class ProviderError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}
export function createProvider(ticket, fetchImpl = fetch) {
  // No user-controlled URLs, no redirects, no ticket in logs or response bodies.
  let lastRequest = 0
  let queue = Promise.resolve()
  async function request(params) {
    if (!ticket) throw new ProviderError('MISSING_TICKET')
    const run = queue.then(async () => {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 1200 - (Date.now() - lastRequest))),
      )
      lastRequest = Date.now()
      const url = new URL(
        'https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json',
      )
      for (const [key, value] of Object.entries({ ...params, ticket }))
        url.searchParams.set(key, value)
      let response
      try {
        response = await fetchImpl(url, {
          signal: AbortSignal.timeout(20000),
          redirect: 'error',
          headers: { Accept: 'application/json' },
        })
      } catch {
        throw new ProviderError('UPSTREAM_UNAVAILABLE')
      }
      if (!response.ok)
        throw new ProviderError(
          response.status === 429
            ? 'UPSTREAM_RATE_LIMIT'
            : 'UPSTREAM_UNAVAILABLE',
        )
      if (Number(response.headers.get('content-length')) > 8_000_000)
        throw new ProviderError('UPSTREAM_TOO_LARGE')
      const reader = response.body.getReader()
      const chunks = []
      let bytes = 0
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > 8_000_000) {
            await reader.cancel()
            throw new ProviderError('UPSTREAM_TOO_LARGE')
          }
          chunks.push(Buffer.from(value))
        }
      } catch (error) {
        throw error instanceof ProviderError
          ? error
          : new ProviderError('UPSTREAM_UNAVAILABLE')
      }
      let json
      try {
        json = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        throw new ProviderError('UPSTREAM_INVALID_RESPONSE')
      }
      if (!Array.isArray(json.Listado) || json.Listado.length > 15000)
        throw new ProviderError('UPSTREAM_INVALID_RESPONSE')
      return json.Listado
    })
    queue = run.catch(() => {})
    return run
  }
  return {
    async list(date) {
      return (await request({ fecha: date })).map((row) => normalizeTender(row))
    },
    async detail(id) {
      if (!/^[\w-]{3,80}$/.test(id)) throw new ProviderError('INVALID_CODE')
      const rows = await request({ codigo: id })
      if (rows.length !== 1 || rows[0].CodigoExterno !== id)
        throw new ProviderError('UPSTREAM_NOT_FOUND')
      return normalizeTender(rows[0], true)
    },
  }
}
