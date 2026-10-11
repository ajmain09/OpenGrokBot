import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

console.log('[build-verify] Starting OpenGrokBot verified build...')

function run(cmd, desc) {
  console.log(`[build-verify] -> ${desc} (${cmd})...`)
  const start = Date.now()
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '1' } })
    const ms = Date.now() - start
    console.log(`[build-verify] ✓ ${desc} passed (${ms}ms)`)
    return true
  } catch (err) {
    console.error(`[build-verify] ✗ ${desc} failed!`)
    throw err
  }
}

try {
  // 1. Typecheck
  run('npm run typecheck', 'Typecheck')

  // 2. Tests
  run('npm test', 'Test suite')

  // 3. Client & Server Build
  run('npm run build', 'Build')

  console.log('[build-verify] ★ All checks and build succeeded! Desktop app ready.')
} catch (err) {
  console.error('[build-verify] Build verification encountered an error:', err.message)
  process.exit(1)
}
