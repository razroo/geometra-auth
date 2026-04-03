import type { IncomingMessage } from 'node:http'
import type { Role, TokenVerifier, TokenVerifierResult } from './types.js'

/**
 * Creates a verifier from a static token→role map.
 * Good for demos, dev servers, and simple deployments.
 *
 * ```ts
 * const verify = staticTokens({
 *   'admin-secret': 'admin',
 *   'viewer-secret': 'viewer',
 * })
 * ```
 */
export function staticTokens(
  map: Record<string, Role>,
): TokenVerifier {
  return (token: string) => {
    const role = map[token]
    return role ? { role } : null
  }
}

/**
 * Creates a verifier that delegates to a remote HTTP endpoint.
 * Sends the token as a Bearer header and expects `{ role, claims? }` back.
 *
 * ```ts
 * const verify = remoteVerifier('https://auth.example.com/verify')
 * ```
 */
export function remoteVerifier(
  endpoint: string,
  options?: {
    /** Header name. Default: "Authorization" */
    header?: string
    /** Prefix before the token. Default: "Bearer " */
    prefix?: string
    /** Timeout in ms. Default: 5000 */
    timeout?: number
  },
): TokenVerifier {
  const header = options?.header ?? 'Authorization'
  const prefix = options?.prefix ?? 'Bearer '
  const timeout = options?.timeout ?? 5000

  return async (
    token: string,
    _request: IncomingMessage,
  ): Promise<TokenVerifierResult> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          [header]: `${prefix}${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })

      if (!res.ok) return null

      const body = (await res.json()) as { role?: string; claims?: Record<string, unknown> }
      if (!body.role) return null

      return { role: body.role, claims: body.claims }
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * Chains multiple verifiers — the first to return a result wins.
 *
 * ```ts
 * const verify = chainVerifiers(
 *   staticTokens({ 'dev-admin': 'admin' }),
 *   remoteVerifier('https://auth.example.com/verify'),
 * )
 * ```
 */
export function chainVerifiers(
  ...verifiers: TokenVerifier[]
): TokenVerifier {
  return async (
    token: string,
    request: IncomingMessage,
  ): Promise<TokenVerifierResult> => {
    for (const verify of verifiers) {
      const result = await verify(token, request)
      if (result) return result
    }
    return null
  }
}
