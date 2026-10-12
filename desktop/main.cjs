// Electron shell: starts the office server as a child Node process and opens it in a window.
const { app, BrowserWindow, shell } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const http = require('node:http')
const fs = require('node:fs')

const PORT = Number(process.env.PORT ?? 4310)
const URL = `http://127.0.0.1:${PORT}/`
const root = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..')
let server = null

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`
  try {
    const logDir = path.join(root, 'data')
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    fs.appendFileSync(path.join(logDir, 'desktop.log'), line)
  } catch {}
}

process.on('uncaughtException', (err) => {
  log('[desktop uncaughtException]', err?.stack || err)
})
process.on('unhandledRejection', (err) => {
  log('[desktop unhandledRejection]', err?.stack || err)
})

function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(`${URL}api/state`, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
  })
}

async function startServer() {
  const isRunning = await checkServerRunning()
  if (isRunning) {
    log('[desktop] local server is already running on port', PORT)
    return
  }

  const scriptPath = path.join(root, 'dist', 'server', 'index.js')
  const env = { ...process.env, PORT: String(PORT) }
  let execBin = process.execPath

  if (app.isPackaged) {
    env.ELECTRON_RUN_AS_NODE = '1'
  } else {
    delete env.ELECTRON_RUN_AS_NODE
    if (process.platform === 'win32' && fs.existsSync('C:\\Program Files\\nodejs\\node.exe')) {
      execBin = 'C:\\Program Files\\nodejs\\node.exe'
    } else {
      execBin = 'node'
    }
  }

  // Create data directory for desktop log
  const logDir = path.join(root, 'data')
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
  } catch {}
  const logFile = path.join(logDir, 'desktop.log')
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })

  log('[desktop] starting server with', execBin, scriptPath)

  server = spawn(execBin, [scriptPath], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  if (server.stdout) server.stdout.pipe(logStream)
  if (server.stderr) server.stderr.pipe(logStream)

  server.on('exit', (code) => {
    log('[desktop] server process exited with code', code)
    server = null
  })
}

function waitForServer(retries = 80) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const req = http.get(`${URL}api/state`, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (left <= 0) reject(new Error('server did not start'))
        else setTimeout(() => tryOnce(left - 1), 250)
      })
    }
    tryOnce(retries)
  })
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 940,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#FAFAF8',
    title: 'OpenGrokBot Studio',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#F4F5F2', symbolColor: '#1B2421', height: 40 },
    webPreferences: { contextIsolation: true, sandbox: true },
  })

  const splashPath = path.join(__dirname, 'splash.html')
  if (fs.existsSync(splashPath)) {
    try { await win.loadFile(splashPath) } catch {}
  }
  win.show()

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  try {
    await waitForServer(80)
    await win.loadURL(URL)
  } catch (err) {
    log('[desktop] Server initialization error:', err?.message || err)
    const errHtml = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #FAFAF8; color: #1B2421; font-family: system-ui; text-align: center; }
        .card { max-width: 440px; padding: 28px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        button { background: #18836B; color: white; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 16px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h3 style="margin: 0 0 8px 0;">Connecting to OpenGrokBot…</h3>
        <p style="color: #64748b; font-size: 13px; margin: 0;">Initializing local database and AI provider connections.</p>
        <button onclick="location.href='${URL}'">Retry Connection</button>
      </div>
    </body>
    </html>`
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errHtml)}`)
  }
}

app.whenReady().then(async () => {
  log('[desktop] app ready, initializing server...')
  await startServer()
  try {
    await createWindow()
  } catch (err) {
    log('[desktop] createWindow error:', err?.stack || err)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  app.isQuitting = true
  if (server) server.kill()
  app.quit()
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (server) server.kill()
})
