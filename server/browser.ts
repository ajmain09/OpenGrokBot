import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import type { BrowserProfileInfo } from '../shared/types.js'

function findChromePath(): string | null {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.PROGRAMFILES ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
  ]
  for (const c of candidates) {
    if (c && existsSync(c)) return c
  }
  return null
}

function getDirSizeBytes(dirPath: string): number {
  if (!existsSync(dirPath)) return 0
  let total = 0
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += getDirSizeBytes(full)
      } else if (entry.isFile()) {
        try {
          total += statSync(full).size
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
  return total
}

export class BrowserManager {
  private readonly profilesDir: string
  private readonly activeChildren = new Map<string, ReturnType<typeof spawn>>()

  constructor(workspaceDir: string) {
    this.profilesDir = path.join(workspaceDir, 'data', 'browser-profiles')
    mkdirSync(this.profilesDir, { recursive: true })
    mkdirSync(path.join(this.profilesDir, 'lead-hunt'), { recursive: true })
    mkdirSync(path.join(this.profilesDir, 'marketing'), { recursive: true })
  }

  getProfiles(): BrowserProfileInfo[] {
    const defs: { id: 'lead-hunt' | 'marketing'; name: string; purpose: string }[] = [
      {
        id: 'lead-hunt',
        name: 'Profile 1 — Research',
        purpose: 'Google Search, business websites, public Facebook directories, lead research',
      },
      {
        id: 'marketing',
        name: 'Profile 2 — Business',
        purpose: 'WhatsApp Web, approved communications, business follow-ups & drafts',
      },
    ]

    return defs.map((d) => {
      const pDir = path.join(this.profilesDir, d.id)
      const exists = existsSync(pDir)
      const lockFile = path.join(pDir, 'SingletonLock')
      const isSpawned = this.activeChildren.has(d.id)
      const active = isSpawned || existsSync(lockFile)
      const sizeBytes = getDirSizeBytes(pDir)

      let lastActivity = Date.now()
      if (exists) {
        try {
          lastActivity = statSync(pDir).mtimeMs
        } catch {
          // fallback
        }
      }

      return {
        id: d.id,
        name: d.name,
        purpose: d.purpose,
        path: pDir,
        exists,
        sizeBytes,
        active,
        lastActivity,
        status: active ? 'running' : exists ? 'idle' : 'uninitialized',
      }
    })
  }

  openProfile(profileId: 'lead-hunt' | 'marketing'): { ok: boolean; message: string } {
    const chrome = findChromePath()
    if (!chrome) {
      return { ok: false, message: 'Google Chrome installation not found in standard paths.' }
    }

    const pDir = path.join(this.profilesDir, profileId)
    mkdirSync(pDir, { recursive: true })

    try {
      const child = spawn(chrome, [`--user-data-dir=${pDir}`, '--no-first-run', '--no-default-browser-check'], {
        detached: true,
        stdio: 'ignore',
      })
      child.unref()
      this.activeChildren.set(profileId, child)
      child.on('exit', () => {
        this.activeChildren.delete(profileId)
      })
      return { ok: true, message: `Opened ${profileId} profile in Chrome window.` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  restartProfile(profileId: 'lead-hunt' | 'marketing'): { ok: boolean; message: string } {
    const child = this.activeChildren.get(profileId)
    if (child) {
      try {
        child.kill()
      } catch {
        // ignore
      }
      this.activeChildren.delete(profileId)
    }

    // Clean stale lock file if present
    const lockFile = path.join(this.profilesDir, profileId, 'SingletonLock')
    if (existsSync(lockFile)) {
      try {
        unlinkSync(lockFile)
      } catch {
        // ignore
      }
    }

    return { ok: true, message: `Profile ${profileId} reset and ready.` }
  }
}
