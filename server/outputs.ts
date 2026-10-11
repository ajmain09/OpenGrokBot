import { execFile, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { OutputFile } from '../shared/types.js'

function getDefaultOutputDir(): string {
  const userProfile = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Default'
  return path.join(userProfile, 'Documents', 'OpenGrokBot', 'Outputs')
}

export class OutputManager {
  private baseDir: string
  private readonly configFile: string

  constructor(dataDir: string) {
    this.configFile = path.join(dataDir, 'outputs-config.json')
    this.baseDir = this.loadConfiguredDir()
    this.ensureDirs()
  }

  private loadConfiguredDir(): string {
    if (existsSync(this.configFile)) {
      try {
        const raw = JSON.parse(readFileSync(this.configFile, 'utf8')) as { dir?: string }
        if (raw.dir && typeof raw.dir === 'string' && existsSync(raw.dir)) {
          return raw.dir
        }
      } catch {
        // use default
      }
    }
    return getDefaultOutputDir()
  }

  private ensureDirs(): void {
    try {
      mkdirSync(this.baseDir, { recursive: true })
      mkdirSync(path.join(this.baseDir, 'Lead-Hunt'), { recursive: true })
      mkdirSync(path.join(this.baseDir, 'Marketing'), { recursive: true })
    } catch {
      // non-critical
    }
  }

  getBaseDir(): string {
    return this.baseDir
  }

  setBaseDir(newDir: string): boolean {
    try {
      mkdirSync(newDir, { recursive: true })
      this.baseDir = newDir
      this.ensureDirs()
      writeFileSync(this.configFile, JSON.stringify({ dir: newDir }, null, 2), 'utf8')
      return true
    } catch {
      return false
    }
  }

  list(): OutputFile[] {
    this.ensureDirs()
    const categories: ('Lead-Hunt' | 'Marketing')[] = ['Lead-Hunt', 'Marketing']
    const result: OutputFile[] = []

    for (const cat of categories) {
      const catDir = path.join(this.baseDir, cat)
      if (!existsSync(catDir)) continue
      try {
        const files = readdirSync(catDir)
        for (const f of files) {
          const fullPath = path.join(catDir, f)
          try {
            const st = statSync(fullPath)
            if (st.isFile()) {
              result.push({
                id: `${cat}-${f}`,
                name: f,
                category: cat,
                path: fullPath,
                size: st.size,
                updatedAt: st.mtimeMs,
                ext: path.extname(f).toLowerCase(),
              })
            }
          } catch {
            // skip unreadable
          }
        }
      } catch {
        // skip
      }
    }

    result.sort((a, b) => b.updatedAt - a.updatedAt)
    return result
  }

  saveFile(category: 'Lead-Hunt' | 'Marketing', filename: string, content: string | Buffer): string {
    this.ensureDirs()
    const targetFolder = path.join(this.baseDir, category)
    let finalName = filename
    let targetPath = path.join(targetFolder, finalName)

    // Prevent accidental overwriting: rename with timestamp if file already exists
    if (existsSync(targetPath)) {
      const ext = path.extname(filename)
      const base = path.basename(filename, ext)
      finalName = `${base}-${Date.now()}${ext}`
      targetPath = path.join(targetFolder, finalName)
    }

    writeFileSync(targetPath, content)
    return targetPath
  }

  openPath(targetPath: string): boolean {
    if (!existsSync(targetPath)) return false
    try {
      if (process.platform === 'win32') {
        execFile('explorer.exe', [targetPath], () => {})
      }
      return true
    } catch {
      return false
    }
  }

  openFolder(category?: 'Lead-Hunt' | 'Marketing'): boolean {
    const dir = category ? path.join(this.baseDir, category) : this.baseDir
    this.ensureDirs()
    return this.openPath(dir)
  }

  readFilePreview(targetPath: string, maxBytes = 32_000): { content: string; binary: boolean } | null {
    if (!existsSync(targetPath)) return null
    try {
      const buf = readFileSync(targetPath)
      // Check if text or binary
      const isBinary = buf.slice(0, 512).includes(0)
      if (isBinary) {
        return { content: `[Binary file, size: ${buf.length} bytes]`, binary: true }
      }
      return { content: buf.slice(0, maxBytes).toString('utf8'), binary: false }
    } catch {
      return null
    }
  }

  copyFileTo(targetPath: string, destinationDir: string): boolean {
    if (!existsSync(targetPath)) return false
    try {
      mkdirSync(destinationDir, { recursive: true })
      const dest = path.join(destinationDir, path.basename(targetPath))
      copyFileSync(targetPath, dest)
      return true
    } catch {
      return false
    }
  }
}
