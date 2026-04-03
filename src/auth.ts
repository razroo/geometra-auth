import type { IncomingMessage } from 'node:http'
import type {
  AuthContext,
  AuthHooks,
  AuthOptions,
  RolePolicy,
} from './types.js'

/**
 * Default token extractor — reads `?token=` from the URL query string.
 */
function defaultExtractToken(request: IncomingMessage): string | null {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
  return url.searchParams.get('token')
}

/**
 * Check whether a message type is allowed by a role policy.
 */
function isAllowed(messageType: string, policy: RolePolicy | undefined): boolean {
  if (!policy) return true

  if (policy.allow && !policy.allow.includes(messageType)) {
    return false
  }

  if (policy.deny && policy.deny.includes(messageType)) {
    return false
  }

  return true
}

/**
 * Creates authentication hooks for `@geometra/server`'s `createServer()`.
 *
 * ```ts
 * import { createAuth, staticTokens } from '@geometra/auth'
 * import { createServer } from '@geometra/server'
 *
 * const auth = createAuth({
 *   verify: staticTokens({
 *     'secret-admin': 'admin',
 *     'secret-viewer': 'viewer',
 *   }),
 *   policies: {
 *     viewer: { allow: ['resize'] },
 *   },
 * })
 *
 * const server = await createServer(view, {
 *   port: 3100,
 *   ...auth,
 * })
 * ```
 */
export function createAuth(options: AuthOptions): AuthHooks {
  const {
    verify,
    policies,
    extractToken = defaultExtractToken,
    onAccept,
    onReject,
    onBlock,
    onLeave,
  } = options

  const onConnection = async (
    request: IncomingMessage,
  ): Promise<AuthContext | null> => {
    const token = extractToken(request)

    if (!token) {
      onReject?.('no token', request)
      return null
    }

    let result
    try {
      result = await verify(token, request)
    } catch {
      onReject?.('verify threw', request)
      return null
    }

    if (!result) {
      onReject?.('invalid token', request)
      return null
    }

    const context: AuthContext = {
      role: result.role,
      token,
      claims: result.claims ?? {},
    }

    onAccept?.(context)
    return context
  }

  const onMessage = (
    message: { type: string },
    context: unknown,
  ): boolean => {
    const auth = context as AuthContext
    const policy = policies?.[auth.role]
    const allowed = isAllowed(message.type, policy)

    if (!allowed) {
      onBlock?.(message.type, auth)
    }

    return allowed
  }

  const onDisconnect = (context: unknown): void => {
    onLeave?.(context as AuthContext)
  }

  return { onConnection, onMessage, onDisconnect }
}
