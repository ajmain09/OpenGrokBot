import { execFile } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { OutputFile } from '../shared/types.js'

function getDefaultOutputDir(): string {
  const userProfile = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Default'
  return path.join(userProfile, 'Documents', 'OpenGrokBot', 'Outputs')
}

function sanitizeBrandDir(brandId?: string): string {
  if (!brandId) return 'Growthifyx'
  if (brandId === 'the-solver-agency') return 'The-Solver-Agency'
  if (brandId === 'growthifyx') return 'Growthifyx'
  return brandId.replace(/[^a-zA-Z0-9_-]/g, '_')
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
      // Root-level categories
      mkdirSync(path.join(this.baseDir, 'Lead-Hunt'), { recursive: true })
      mkdirSync(path.join(this.baseDir, 'Marketing'), { recursive: true })
      // Multi-brand categories
      const brands = ['Growthifyx', 'The-Solver-Agency']
      for (const b of brands) {
        mkdirSync(path.join(this.baseDir, b, 'Lead-Hunt'), { recursive: true })
        mkdirSync(path.join(this.baseDir, b, 'Marketing'), { recursive: true })
      }
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

  list(brandFilter?: string): OutputFile[] {
    this.ensureDirs()
    const categories: ('Lead-Hunt' | 'Marketing')[] = ['Lead-Hunt', 'Marketing']
    const result: OutputFile[] = []

    const scanDir = (dir: string, cat: 'Lead-Hunt' | 'Marketing', brandId?: string) => {
      if (!existsSync(dir)) return
      try {
        const files = readdirSync(dir)
        for (const f of files) {
          const fullPath = path.join(dir, f)
          try {
            const st = statSync(fullPath)
            if (st.isFile()) {
              result.push({
                id: `${brandId || 'root'}-${cat}-${f}`,
                brandId,
                name: f,
                category: cat,
                path: fullPath,
                size: st.size,
                updatedAt: st.mtimeMs,
                ext: path.extname(f).toLowerCase(),
              })
            }
          } catch {
            // skip
          }
        }
      } catch {
        // skip
      }
    }

    // 1. Scan root categories
    for (const cat of categories) {
      scanDir(path.join(this.baseDir, cat), cat, undefined)
    }

    // 2. Scan brand directories
    const brandFolders = ['Growthifyx', 'The-Solver-Agency']
    for (const bFolder of brandFolders) {
      const bId = bFolder.toLowerCase() === 'the-solver-agency' ? 'the-solver-agency' : 'growthifyx'
      for (const cat of categories) {
        scanDir(path.join(this.baseDir, bFolder, cat), cat, bId)
      }
    }

    result.sort((a, b) => b.updatedAt - a.updatedAt)

    if (brandFilter) {
      return result.filter((f) => !f.brandId || f.brandId === brandFilter)
    }
    return result
  }

  saveFile(category: 'Lead-Hunt' | 'Marketing', filename: string, content: string | Buffer, brandId?: string): string {
    this.ensureDirs()
    const brandFolder = sanitizeBrandDir(brandId)
    const targetFolder = path.join(this.baseDir, brandFolder, category)
    mkdirSync(targetFolder, { recursive: true })

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

  openFolder(category?: 'Lead-Hunt' | 'Marketing', brandId?: string): boolean {
    this.ensureDirs()
    let dir = this.baseDir
    if (brandId) {
      const brandFolder = sanitizeBrandDir(brandId)
      dir = category ? path.join(this.baseDir, brandFolder, category) : path.join(this.baseDir, brandFolder)
    } else if (category) {
      dir = path.join(this.baseDir, category)
    }
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return this.openPath(dir)
  }

  readFilePreview(targetPath: string, maxBytes = 32_000): { content: string; binary: boolean } | null {
    if (!existsSync(targetPath)) return null
    try {
      const buf = readFileSync(targetPath)
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
