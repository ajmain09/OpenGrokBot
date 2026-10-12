import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { AuditLogEntry } from '../shared/types.js'

function scrubSensitiveData(text: string): string {
  if (!text) return ''
  return text
    .replace(/(bearer\s+)[A-Za-z0-9_\-\.]{15,}/gi, '$1[REDACTED_TOKEN]')
    .replace(/(EAAB[A-Za-z0-9]+)/gi, '[REDACTED_META_TOKEN]')
    .replace(/(key[-_]?=|\bapi[_-]?key\b\s*[:=]\s*)[A-Za-z0-9_\-\.]{15,}/gi, '$1[REDACTED_API_KEY]')
    .replace(/(password\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED_PASSWORD]')
}

export class AuditLogger {
  private readonly logFile: string
  private entries: AuditLogEntry[] = []

  constructor(dataDir = path.join(process.cwd(), 'data')) {
    mkdirSync(dataDir, { recursive: true })
    this.logFile = path.join(dataDir, 'audit-log.json')
    this.load()
  }

  private load(): void {
    if (existsSync(this.logFile)) {
      try {
        const raw = JSON.parse(readFileSync(this.logFile, 'utf8')) as AuditLogEntry[]
        if (Array.isArray(raw)) {
          this.entries = raw.slice(-1000)
          return
        }
      } catch {
        // start empty
      }
    }
    this.entries = []
  }

  private save(): void {
    try {
      const tmp = `${this.logFile}.tmp`
      writeFileSync(tmp, JSON.stringify(this.entries.slice(-1000), null, 2), 'utf8')
      renameSync(tmp, this.logFile)
    } catch {
      // non-critical
    }
  }

  record(input: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: Date.now(),
      brandId: input.brandId,
      agentId: input.agentId,
      taskId: input.taskId,
      category: input.category,
      tool: scrubSensitiveData(input.tool),
      actionSummary: scrubSensitiveData(input.actionSummary),
      decision: input.decision,
      reason: input.reason ? scrubSensitiveData(input.reason) : undefined,
      result: input.result ? scrubSensitiveData(input.result) : undefined,
      error: input.error ? scrubSensitiveData(input.error) : undefined,
      outputRef: input.outputRef,
    }

    this.entries.unshift(entry)
    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(0, 1000)
    }
    this.save()
    return entry
  }

  list(filters?: { brandId?: string; category?: string; decision?: string }): AuditLogEntry[] {
    let list = [...this.entries]
    if (filters?.brandId && filters.brandId !== 'all') {
      list = list.filter((e) => !e.brandId || e.brandId === filters.brandId)
    }
    if (filters?.category && filters.category !== 'all') {
      list = list.filter((e) => e.category === filters.category)
    }
    if (filters?.decision && filters.decision !== 'all') {
      list = list.filter((e) => e.decision === filters.decision)
    }
    return list
  }

  clear(): void {
    this.entries = []
    this.save()
  }
}

