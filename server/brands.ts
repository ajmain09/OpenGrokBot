import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DEFAULT_BRANDS, type Brand } from '../shared/types.js'

export class BrandsStore {
  private readonly file: string
  private brands: Brand[] = []

  constructor(workspaceDir: string) {
    const dataDir = path.join(workspaceDir, 'data')
    mkdirSync(dataDir, { recursive: true })
    this.file = path.join(dataDir, 'brands.json')
    this.load()
  }

  private load(): void {
    if (existsSync(this.file)) {
      try {
        const raw = readFileSync(this.file, 'utf8')
        this.brands = JSON.parse(raw) as Brand[]
        if (this.brands.length === 0) {
          this.brands = [...DEFAULT_BRANDS]
          this.save()
        }
        return
      } catch {
        // Fallback to defaults
      }
    }
    this.brands = [...DEFAULT_BRANDS]
    this.save()
  }

  private save(): void {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.brands, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }

  list(): Brand[] {
    return [...this.brands]
  }

  get(id: string): Brand | undefined {
    return this.brands.find((b) => b.id === id)
  }

  create(input: { id?: string; name: string; tagline?: string; description?: string; website?: string; color?: string }): Brand {
    const rawId = input.id || input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
    let id = rawId.replace(/^-+|-+$/g, '') || `brand-${Date.now()}`
    let n = 2
    while (this.brands.some((b) => b.id === id)) {
      id = `${rawId}-${n++}`
    }

    const brand: Brand = {
      id,
      name: input.name.trim(),
      tagline: input.tagline?.trim() || `${input.name.trim()} Workspace`,
      description: input.description?.trim(),
      website: input.website?.trim(),
      color: input.color?.trim() || '#18836B',
      createdAt: Date.now(),
    }

    this.brands.push(brand)
    this.save()
    return brand
  }

  update(id: string, patch: Partial<Brand>): Brand {
    const idx = this.brands.findIndex((b) => b.id === id)
    if (idx === -1) throw new Error(`Brand not found: ${id}`)
    const existing = this.brands[idx]
    if (!existing) throw new Error(`Brand not found: ${id}`)
    const updated: Brand = {
      ...existing,
      ...patch,
      id: existing.id, // prevent changing ID
    }
    this.brands[idx] = updated
    this.save()
    return updated
  }

  delete(id: string): boolean {
    if (this.brands.length <= 1) {
      throw new Error('Cannot delete the last brand.')
    }
    const before = this.brands.length
    this.brands = this.brands.filter((b) => b.id !== id)
    if (this.brands.length !== before) {
      this.save()
      return true
    }
    return false
  }
}

