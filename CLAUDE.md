# @geometra/auth

Token-based WebSocket authentication package for the Geometra DOM-free UI framework.

## What This Project Is

This is a standalone npm package (`@geometra/auth`) that provides authentication hooks for Geometra's server/client protocol. It extracts and generalizes the auth pattern from Geometra's `demos/auth-server-client/` demo into a reusable library.

The core idea: since Geometra's server is the rendering authority (it computes layout and streams geometry), auth naturally belongs at the protocol layer. The server gates **connections** via token validation and gates **messages** via per-role policies — a viewer literally cannot interact because the server filters their input at the WebSocket level.

## Architecture

- **`src/types.ts`** — All TypeScript interfaces (`AuthContext`, `AuthOptions`, `RolePolicy`, `TokenVerifier`, etc.)
- **`src/auth.ts`** — `createAuth()` — returns `{ onConnection, onMessage, onDisconnect }` hooks compatible with `@geometra/server`'s `createServer()` options
- **`src/verifiers.ts`** — Token verification strategies: `staticTokens()`, `remoteVerifier()`, `chainVerifiers()`
- **`src/client.ts`** — `connectWithAuth()` — client-side helper wrapping `@geometra/client`'s `createClient()` with token injection
- **`src/index.ts`** — Main entry point (server-side exports)

## Build & Test

```bash
bun install
bun run check    # tsc --noEmit
bun test         # bun test runner
bun run build    # tsc → dist/
```

## Code Conventions

- ESM (`"type": "module"`) with `.js` extensions in imports
- Strict TypeScript, `nodenext` module resolution
- `@geometra/server` is a required peer dep; `@geometra/client` is optional
- Tests use Bun's built-in test runner (`bun:test`)
- No runtime dependencies — only peer deps on Geometra packages

## Relationship to Geometra

Lives alongside the main Geometra repo at `../geometra`. Dev dependencies link to Geometra packages via `file:../geometra/packages/*`. For publishing, these become standard semver peer dependencies (`>=1.0.0`).
