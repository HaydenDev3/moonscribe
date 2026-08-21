import { spawn } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = [
  // Keep API/auth configuration beside the Vite configuration during local
  // development. Node's env-file support avoids adding another dependency.
  spawn(process.execPath, ['--env-file-if-exists=.env.local', 'server/index.js'], { stdio: 'inherit' }),
  spawn(npm, ['exec', 'vite'], { stdio: 'inherit', shell: process.platform === 'win32' }),
]

let closing = false
function close(code = 0) {
  if (closing) return
  closing = true
  for (const child of children) child.kill()
  process.exitCode = code
}

for (const child of children) child.on('exit', (code) => {
  if (!closing && code) close(code)
})
process.on('SIGINT', () => close(0))
process.on('SIGTERM', () => close(0))
