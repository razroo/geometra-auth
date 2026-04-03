import { signal, box, text } from '@geometra/core/node'
import { createServer } from '@geometra/server'
import { createAuth, staticTokens } from '@geometra/auth'

// ─── App State ──────────────────────────────────────────────────────────────
const count = signal(0)
const connectedClients = signal(0)

function view() {
  return box(
    { flexDirection: 'column', padding: 24, gap: 16, width: 460, height: 340 },
    [
      box(
        {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0a0a1a',
          padding: 12,
          borderRadius: 8,
        },
        [
          text({
            text: 'Auth Demo (@geometra/auth)',
            font: 'bold 16px Inter, system-ui',
            lineHeight: 22,
            color: '#e94560',
          }),
          text({
            text: `${connectedClients.value} connected`,
            font: '12px Inter, system-ui',
            lineHeight: 16,
            color: '#666',
          }),
        ],
      ),

      box({ flexDirection: 'column', gap: 8, flexGrow: 1 }, [
        text({
          text: `Count: ${count.value}`,
          font: 'bold 32px Inter, system-ui',
          lineHeight: 40,
          color: '#ffffff',
        }),
        box(
          {
            backgroundColor: '#e94560',
            borderRadius: 8,
            padding: 12,
            cursor: 'pointer',
            alignSelf: 'flex-start',
            onClick: () => {
              count.set(count.peek() + 1)
            },
          },
          [
            text({
              text: '+ Increment',
              font: '600 14px Inter, system-ui',
              lineHeight: 20,
              color: '#ffffff',
            }),
          ],
        ),
        box({ height: 8 }, []),
        text({
          text: 'Admins can click the button. Viewers receive "Forbidden".',
          font: '13px Inter, system-ui',
          lineHeight: 18,
          color: '#555',
        }),
      ]),
    ],
  )
}

// ─── Auth via @geometra/auth ────────────────────────────────────────────────
const auth = createAuth({
  verify: staticTokens({
    'admin-token-demo': 'admin',
    'viewer-token-demo': 'viewer',
  }),

  // Viewers can only receive frames — block all input events
  policies: {
    viewer: { allow: ['resize'] },
  },

  onAccept: (ctx) => {
    console.log(`[auth] accepted — role: ${ctx.role}`)
    connectedClients.set(connectedClients.peek() + 1)
    server.update()
  },

  onReject: (reason) => {
    console.log(`[auth] rejected — ${reason}`)
  },

  onBlock: (messageType, ctx) => {
    console.log(`[auth] blocked ${messageType} from ${ctx.role}`)
  },

  onLeave: (ctx) => {
    console.log(`[auth] disconnected — role: ${ctx.role}`)
    connectedClients.set(Math.max(0, connectedClients.peek() - 1))
    server.update()
  },
})

// ─── Server ─────────────────────────────────────────────────────────────────
const server = await createServer(view, {
  port: 3100,
  width: 460,
  height: 340,
  ...auth,
})

console.log(`
  Geometra Auth Example
  ─────────────────────
  Listening on ws://localhost:3100

  Tokens:
    admin  → admin-token-demo   (full access)
    viewer → viewer-token-demo  (read-only, events rejected)
    other  → connection refused (4001)

  Run the client:  npm run client  (in another terminal)
`)
