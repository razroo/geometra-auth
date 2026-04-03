import type { IncomingMessage } from 'node:http'

/** A role string (e.g. "admin", "viewer") */
export type Role = string

/** Context attached to each authenticated connection */
export interface AuthContext {
  role: Role
  /** The original token string (for logging / audit) */
  token: string
  /** Arbitrary user-supplied data returned from the verifier */
  claims: Record<string, unknown>
}

/**
 * Takes a raw token string and resolves to role + claims,
 * or null/undefined to reject the connection.
 */
export type TokenVerifier = (
  token: string,
  request: IncomingMessage,
) => TokenVerifierResult | Promise<TokenVerifierResult>

export type TokenVerifierResult =
  | { role: Role; claims?: Record<string, unknown> }
  | null
  | undefined

/** Per-role permission policy */
export interface RolePolicy {
  /** Message types this role is allowed to send. Default: all. */
  allow?: string[]
  /** Message types this role is blocked from sending. Applied after allow. */
  deny?: string[]
}

/** Configuration for createAuth() */
export interface AuthOptions {
  /**
   * Validates a token and returns { role, claims } or null to reject.
   * For simple static tokens, use `staticTokens()` helper.
   */
  verify: TokenVerifier

  /**
   * Per-role message policies.
   * If a role is not listed, all messages are allowed.
   */
  policies?: Record<Role, RolePolicy>

  /**
   * Extract the token from the incoming request.
   * Default: reads `token` query parameter from the URL.
   */
  extractToken?: (request: IncomingMessage) => string | null

  /** Called when a connection is accepted */
  onAccept?: (context: AuthContext) => void

  /** Called when a connection is rejected */
  onReject?: (reason: string, request: IncomingMessage) => void

  /** Called when a message is blocked by policy */
  onBlock?: (messageType: string, context: AuthContext) => void

  /** Called when a connection disconnects */
  onLeave?: (context: AuthContext) => void
}

/** The hooks object returned by createAuth(), spread into createServer() options */
export interface AuthHooks {
  onConnection: (request: IncomingMessage) => Promise<AuthContext | null>
  onMessage: (message: { type: string }, context: unknown) => boolean
  onDisconnect: (context: unknown) => void
}
