import { CanvasRenderer } from '@geometra/renderer-canvas'
import { connectWithAuth } from '@geometra/auth/client'

const TOKENS: Record<string, string> = {
  admin: 'admin-token-demo',
  viewer: 'viewer-token-demo',
  invalid: 'this-token-does-not-exist',
}

const canvas = document.getElementById('app') as HTMLCanvasElement
const logEl = document.getElementById('log') as HTMLDivElement
const roleLabel = document.getElementById('role-label') as HTMLSpanElement
const roleBadge = document.getElementById('role-badge') as HTMLSpanElement

let renderer: CanvasRenderer | null = null
let client: { close(): void; layout: unknown } | null = null
let currentRole: string | null = null

function logEntry(type: 'info' | 'success' | 'warn' | 'error' | 'block', msg: string) {
  const icons = { info: '→', success: '✓', warn: '⚠', error: '✗', block: '⛔' }
  const colors = { info: '#71717a', success: '#22c55e', warn: '#f59e0b', error: '#ef4444', block: '#f97316' }
  const el = document.createElement('div')
  el.style.color = colors[type]
  el.style.padding = '2px 0'
  el.textContent = `${icons[type]} ${msg}`
  logEl.appendChild(el)
  logEl.scrollTop = logEl.scrollHeight
}

function clearLog() {
  logEl.innerHTML = ''
}

function setRole(role: string | null, status: 'connected' | 'rejected' | 'none') {
  currentRole = role
  if (status === 'none') {
    roleLabel.textContent = 'Not connected'
    roleBadge.textContent = ''
    roleBadge.className = 'badge'
  } else if (status === 'rejected') {
    roleLabel.textContent = 'Connection rejected'
    roleBadge.textContent = '4001'
    roleBadge.className = 'badge badge-error'
  } else {
    roleLabel.textContent = `Connected as`
    roleBadge.textContent = role!
    roleBadge.className = `badge badge-${role}`
  }
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

  clearLog()
  setRole(null, 'none')

  const token = TOKENS[role] ?? role

  logEntry('info', `Sending WebSocket handshake with token…`)
  logEntry('info', `Token: "${token.slice(0, 20)}${token.length > 20 ? '…' : ''}"`)

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
      setRole(role, 'rejected')
      logEntry('error', `Server closed connection with code 4001`)
      logEntry('error', `Token verification failed — connection refused`)
      logEntry('info', `The server's verify() returned null for this token`)
    },
    onForbidden: () => {
      logEntry('block', `Server blocked event → responded with "Forbidden"`)
      logEntry('block', `Policy for "${currentRole}" role only allows: resize`)
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg !== 'Forbidden') {
        logEntry('error', msg)
      }
    },
  })

  let checks = 0
  const poll = setInterval(() => {
    checks++
    if (client?.layout) {
      clearInterval(poll)
      setRole(role, 'connected')
      logEntry('success', `Token verified — server assigned role: "${role}"`)
      logEntry('success', `Receiving geometry frames from server`)
      if (role === 'admin') {
        logEntry('info', `Admin has no policy restrictions — try clicking "Increment"`)
      } else if (role === 'viewer') {
        logEntry('warn', `Viewer policy: { allow: ['resize'] }`)
        logEntry('info', `Try clicking "Increment" — server will block the event`)
      }
    } else if (checks > 20) {
      clearInterval(poll)
      if (!client?.layout) {
        setRole(role, 'rejected')
        logEntry('error', `Server closed connection with code 4001`)
        logEntry('error', `Token verification failed — connection refused`)
      }
    }
  }, 100)
}

// Expose to onclick handlers in HTML
;(window as unknown as Record<string, unknown>).connectAs = connectAs
