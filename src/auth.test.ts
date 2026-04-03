import { describe, it, expect } from 'bun:test'
import { createAuth } from './auth.js'
import { staticTokens, chainVerifiers } from './verifiers.js'
import type { IncomingMessage } from 'node:http'

// Minimal stub for IncomingMessage
function fakeRequest(url: string): IncomingMessage {
  return { url, headers: { host: 'localhost:3100' } } as IncomingMessage
}

const verify = staticTokens({
  'admin-secret': 'admin',
  'viewer-secret': 'viewer',
})

describe('createAuth', () => {
  describe('onConnection', () => {
    it('accepts a valid admin token', async () => {
      const auth = createAuth({ verify })
      const ctx = await auth.onConnection(fakeRequest('/?token=admin-secret'))
      expect(ctx).not.toBeNull()
      expect(ctx!.role).toBe('admin')
      expect(ctx!.token).toBe('admin-secret')
    })

    it('accepts a valid viewer token', async () => {
      const auth = createAuth({ verify })
      const ctx = await auth.onConnection(fakeRequest('/?token=viewer-secret'))
      expect(ctx).not.toBeNull()
      expect(ctx!.role).toBe('viewer')
    })

    it('rejects an unknown token', async () => {
      const auth = createAuth({ verify })
      const ctx = await auth.onConnection(fakeRequest('/?token=bad'))
      expect(ctx).toBeNull()
    })

    it('rejects when no token is present', async () => {
      const auth = createAuth({ verify })
      const ctx = await auth.onConnection(fakeRequest('/'))
      expect(ctx).toBeNull()
    })

    it('calls onAccept for valid tokens', async () => {
      let accepted = false
      const auth = createAuth({
        verify,
        onAccept: () => { accepted = true },
      })
      await auth.onConnection(fakeRequest('/?token=admin-secret'))
      expect(accepted).toBe(true)
    })

    it('calls onReject for invalid tokens', async () => {
      let reason = ''
      const auth = createAuth({
        verify,
        onReject: (r) => { reason = r },
      })
      await auth.onConnection(fakeRequest('/?token=bad'))
      expect(reason).toBe('invalid token')
    })

    it('calls onReject when no token is present', async () => {
      let reason = ''
      const auth = createAuth({
        verify,
        onReject: (r) => { reason = r },
      })
      await auth.onConnection(fakeRequest('/'))
      expect(reason).toBe('no token')
    })

    it('handles a verify function that throws', async () => {
      const auth = createAuth({
        verify: () => { throw new Error('boom') },
      })
      const ctx = await auth.onConnection(fakeRequest('/?token=x'))
      expect(ctx).toBeNull()
    })

    it('supports custom extractToken', async () => {
      const auth = createAuth({
        verify,
        extractToken: (req) => {
          const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
          return url.searchParams.get('api_key')
        },
      })
      const ctx = await auth.onConnection(fakeRequest('/?api_key=admin-secret'))
      expect(ctx).not.toBeNull()
      expect(ctx!.role).toBe('admin')
    })

    it('supports async verifiers', async () => {
      const asyncVerify = async (token: string) => {
        await new Promise((r) => setTimeout(r, 1))
        return token === 'async-ok' ? { role: 'admin' } : null
      }
      const auth = createAuth({ verify: asyncVerify })
      const ctx = await auth.onConnection(fakeRequest('/?token=async-ok'))
      expect(ctx).not.toBeNull()
      expect(ctx!.role).toBe('admin')
    })
  })

  describe('onMessage', () => {
    it('allows all messages when no policies are set', () => {
      const auth = createAuth({ verify })
      const result = auth.onMessage(
        { type: 'pointerdown' },
        { role: 'viewer', token: 'x', claims: {} },
      )
      expect(result).toBe(true)
    })

    it('blocks messages not in allow list', () => {
      const auth = createAuth({
        verify,
        policies: {
          viewer: { allow: ['resize'] },
        },
      })
      const result = auth.onMessage(
        { type: 'pointerdown' },
        { role: 'viewer', token: 'x', claims: {} },
      )
      expect(result).toBe(false)
    })

    it('allows messages in allow list', () => {
      const auth = createAuth({
        verify,
        policies: {
          viewer: { allow: ['resize'] },
        },
      })
      const result = auth.onMessage(
        { type: 'resize' },
        { role: 'viewer', token: 'x', claims: {} },
      )
      expect(result).toBe(true)
    })

    it('blocks messages in deny list', () => {
      const auth = createAuth({
        verify,
        policies: {
          admin: { deny: ['dangerous'] },
        },
      })
      const result = auth.onMessage(
        { type: 'dangerous' },
        { role: 'admin', token: 'x', claims: {} },
      )
      expect(result).toBe(false)
    })

    it('allows messages for roles without policies', () => {
      const auth = createAuth({
        verify,
        policies: {
          viewer: { allow: ['resize'] },
        },
      })
      const result = auth.onMessage(
        { type: 'pointerdown' },
        { role: 'admin', token: 'x', claims: {} },
      )
      expect(result).toBe(true)
    })

    it('calls onBlock when a message is blocked', () => {
      let blocked = ''
      const auth = createAuth({
        verify,
        policies: { viewer: { allow: ['resize'] } },
        onBlock: (type) => { blocked = type },
      })
      auth.onMessage(
        { type: 'click' },
        { role: 'viewer', token: 'x', claims: {} },
      )
      expect(blocked).toBe('click')
    })
  })

  describe('onDisconnect', () => {
    it('calls onLeave with context', () => {
      let left: unknown = null
      const auth = createAuth({
        verify,
        onLeave: (ctx) => { left = ctx },
      })
      const ctx = { role: 'admin', token: 'x', claims: {} }
      auth.onDisconnect(ctx)
      expect(left).toEqual(ctx)
    })
  })
})

describe('staticTokens', () => {
  it('returns role for known tokens', () => {
    const v = staticTokens({ abc: 'admin' })
    const result = v('abc', fakeRequest('/'))
    expect(result).toEqual({ role: 'admin' })
  })

  it('returns null for unknown tokens', () => {
    const v = staticTokens({ abc: 'admin' })
    const result = v('xyz', fakeRequest('/'))
    expect(result).toBeNull()
  })
})

describe('chainVerifiers', () => {
  it('returns the first successful result', async () => {
    const v = chainVerifiers(
      staticTokens({ a: 'roleA' }),
      staticTokens({ b: 'roleB' }),
    )
    const result = await v('b', fakeRequest('/'))
    expect(result).toEqual({ role: 'roleB' })
  })

  it('returns null if no verifier matches', async () => {
    const v = chainVerifiers(
      staticTokens({ a: 'roleA' }),
    )
    const result = await v('z', fakeRequest('/'))
    expect(result).toBeNull()
  })
})
