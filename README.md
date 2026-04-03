# @geometra/auth

Token-based WebSocket authentication for [Geometra](https://github.com/razroo/geometra) server/client apps.

**[Live Demo](https://razroo.github.io/geometra-auth/)** | [Source](https://github.com/razroo/geometra-auth/tree/main/examples/basic)

> The demo client is hosted on GitHub Pages. To see it in action, run the example server locally with `npm run example` and open the page.

Because Geometra's server computes all layout and streams pre-computed geometry to clients, auth lives at the **protocol layer** — the server controls what each connection can see and do at the frame level.

## Install

```bash
bun add @geometra/auth
```

Peer dependencies: `@geometra/server` (required), `@geometra/client` (optional — only needed for the client helper).

## Server Usage

`createAuth()` returns `onConnection`, `onMessage`, and `onDisconnect` hooks that spread directly into `createServer()` options.

```ts
import { createAuth, staticTokens } from '@geometra/auth'
import { createServer } from '@geometra/server'

const auth = createAuth({
  verify: staticTokens({
    'admin-secret': 'admin',
    'viewer-secret': 'viewer',
  }),
  policies: {
    viewer: { allow: ['resize'] }, // read-only — no input events
  },
})

const server = await createServer(view, {
  port: 3100,
  ...auth,
})
```

### Verifiers

| Verifier | Use case |
|---|---|
| `staticTokens(map)` | Dev / demos — maps token strings to roles |
| `remoteVerifier(url)` | Production — POSTs Bearer token to your auth endpoint, expects `{ role, claims? }` |
| `chainVerifiers(...fns)` | Tries multiple verifiers in order, first match wins |

### Lifecycle Hooks

```ts
createAuth({
  verify: staticTokens({ ... }),
  onAccept: (ctx) => console.log(`connected: ${ctx.role}`),
  onReject: (reason, req) => console.log(`rejected: ${reason}`),
  onBlock: (msgType, ctx) => console.log(`blocked ${msgType} from ${ctx.role}`),
  onLeave: (ctx) => console.log(`disconnected: ${ctx.role}`),
})
```

### Custom Token Extraction

By default, the token is read from the `?token=` query parameter. Override with `extractToken`:

```ts
createAuth({
  verify: myVerifier,
  extractToken: (req) => req.headers['x-api-key'] as string ?? null,
})
```

## Client Usage

```ts
import { connectWithAuth } from '@geometra/auth/client'

const client = await connectWithAuth({
  token: 'admin-secret',
  url: 'ws://localhost:3100',
  renderer,
  canvas,
  onAuthRejected: () => console.log('invalid token'),
  onForbidden: (err) => console.log('action blocked by server'),
})
```

## Role Policies

Policies control which message types each role can send:

```ts
policies: {
  viewer: { allow: ['resize'] },          // whitelist
  restricted: { deny: ['dangerous'] },    // blacklist
  admin: {},                               // no restrictions (default)
}
```

- `allow` — only these message types are permitted (whitelist)
- `deny` — these message types are blocked (blacklist, applied after allow)
- No policy entry = all messages allowed

## Development

```bash
bun install
bun run check    # type check
bun test         # run tests
bun run build    # compile to dist/
```

## License

MIT
