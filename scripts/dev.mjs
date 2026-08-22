import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const children = []
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viteEntry = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')

function spawnNode(args) {
  // Spawning npm.cmd directly can throw EINVAL on Windows depending on the
  // Node/PowerShell combination. Starting both JavaScript entrypoints through
  // the current Node executable is portable and avoids shell quoting entirely.
  return spawn(process.execPath, args, { cwd: projectRoot, stdio: 'inherit' })
}

function portIsOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: 'localhost', port })
    const finish = (open) => {
      socket.destroy()
      resolve(open)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.setTimeout(500, () => finish(false))
  })
}

function restartMoonScribeApi(port) {
  if (process.platform !== 'win32') return
  try {
    const rows = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true })
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 5 && parts[1] === `0.0.0.0:${port}` && parts[3] === 'LISTENING')
    for (const parts of rows) {
      const pid = Number(parts[4])
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      }
    }
  } catch {
    // No process is listening, or the platform does not expose netstat/taskkill.
  }
}

async function start() {
  // Keep API/auth configuration beside the Vite configuration during local
  // development. Reusing an existing local service makes repeated dev/Tauri
  // launches safe and avoids a misleading beforeDevCommand failure.
  // Always refresh the MoonScribe API in development. Reusing a listener here
  // leaves old email/auth code alive after a React restart.
  if (await portIsOpen(3001)) restartMoonScribeApi(3001)
  children.push(spawnNode(['--env-file-if-exists=.env.local', 'server/index.js']))

  if (await portIsOpen(5173)) {
    console.log('   Vite already running on http://localhost:5173; reusing it.')
  } else {
    children.push(spawnNode([viteEntry]))
  }

  for (const child of children) child.on('exit', (code) => {
    if (!closing && code) close(code)
  })

  // Keep the launcher attached to the terminal when both services were
  // started by another MoonScribe process. This preserves the normal dev
  // command lifecycle while avoiding duplicate listeners.
  if (!children.length) setInterval(() => {}, 60_000)
}

let closing = false
function close(code = 0) {
  if (closing) return
  closing = true
  for (const child of children) child.kill()
  process.exitCode = code
}

process.on('SIGINT', () => close(0))
process.on('SIGTERM', () => close(0))

start().catch((error) => {
  console.error('MoonScribe development launcher failed:', error)
  close(1)
})
