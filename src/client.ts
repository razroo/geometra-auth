/**
 * Client-side auth helper for `@geometra/client`.
 *
 * Appends the token to the WebSocket URL and provides typed error handling
 * for auth rejections (4001) and permission blocks (4003 / "Forbidden").
 *
 * ```ts
 * import { connectWithAuth } from '@geometra/auth/client'
 *
 * const client = connectWithAuth({
 *   token: 'my-secret-token',
 *   url: 'ws://localhost:3100',
 *   renderer,
 *   canvas,
 * })
 * ```
 */

export interface AuthClientOptions {
  /** The auth token to send */
  token: string

  /** Base WebSocket URL (default: "ws://localhost:3100") */
  url?: string

  /** Query parameter name for the token (default: "token") */
  tokenParam?: string

  /** Passed through to createClient */
  renderer: unknown

  /** Passed through to createClient */
  canvas?: HTMLCanvasElement

  /** Passed through to createClient */
  reconnect?: boolean

  /** Called on auth rejection (close code 4001) */
  onAuthRejected?: () => void

  /** Called when the server blocks a message (Forbidden) */
  onForbidden?: (error: unknown) => void

  /** Called on other errors */
  onError?: (error: unknown) => void
}

/**
 * Wraps `@geometra/client`'s `createClient()` with token injection and
 * auth-aware error handling.
 */
export async function connectWithAuth(options: AuthClientOptions) {
  const {
    token,
    url = 'ws://localhost:3100',
    tokenParam = 'token',
    renderer,
    canvas,
    reconnect = false,
    onAuthRejected,
    onForbidden,
    onError,
  } = options

  // Dynamically import so @geometra/client stays an optional peer dep
  const { createClient } = await import('@geometra/client')

  const separator = url.includes('?') ? '&' : '?'
  const authUrl = `${url}${separator}${tokenParam}=${encodeURIComponent(token)}`

  return createClient({
    url: authUrl,
    renderer: renderer as never,
    canvas,
    reconnect,
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)

      if (msg === 'Forbidden') {
        onForbidden?.(err)
      } else {
        onError?.(err)
      }
    },
  })
}
