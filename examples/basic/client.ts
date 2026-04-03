import { CanvasRenderer } from '@geometra/renderer-canvas'
import { connectWithAuth } from '@geometra/auth/client'

const TOKENS: Record<string, string> = {
  admin: 'admin-token-demo',
  viewer: 'viewer-token-demo',
  invalid: 'this-token-does-not-exist',
}

const canvas = document.getElementById('app') as HTMLCanvasElement
const statusEl = document.getElementById('status') as HTMLDivElement

let renderer: CanvasRenderer | null = null
let client: { close(): void; layout: unknown } | null = null

function log(msg: string) {
  statusEl.textContent = (statusEl.textContent ?? '') + msg + '\n'
  statusEl.scrollTop = statusEl.scrollHeight
}

function clearStatus() {
  statusEl.textContent = ''
}

async function connectAs(role: string) {
  if (client) {
    client.close()
    client = null
  }
  if (renderer) {
    renderer.destroy()
    renderer = null
  }

  clearStatus()

  const token = TOKENS[role] ?? role
  log(`Connecting as "${role}"…`)

  renderer = new CanvasRenderer({ canvas, background: '#1a1a2e' })

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  client = await connectWithAuth({
    token,
    url: 'ws://localhost:3100',
    renderer,
    canvas,
    reconnect: false,
    onAuthRejected: () => {
      log(`✗ Connection rejected — token not recognized`)
    },
    onForbidden: () => {
      log(`⛔ Server rejected event: Forbidden`)
      log(`   (viewer role cannot send input events)`)
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err)
      log(`❌ Error: ${msg}`)
    },
  })

  // Detect successful connection by polling for received layout
  let checks = 0
  const poll = setInterval(() => {
    checks++
    if (client?.layout) {
      clearInterval(poll)
      log(`✓ Connected as ${role} — receiving geometry frames`)
      if (role === 'viewer') {
        log(`  (try clicking the button — it will be rejected)`)
      }
    } else if (checks > 20) {
      clearInterval(poll)
      if (!client?.layout) {
        log(`✗ Connection failed — server rejected (code 4001)`)
      }
    }
  }, 100)
}

// Expose to onclick handlers in HTML
;(window as unknown as Record<string, unknown>).connectAs = connectAs
