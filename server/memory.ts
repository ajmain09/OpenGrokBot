import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Agent, MemoryItem, Message, Team } from '../shared/types.js'

const MAX_CHARS = 4000
const WORKSPACE_AGENTS = new Set(['lead_collection_specialist', 'marketing'])

export class Memory {
  private readonly dir: string
  private readonly itemsFile: string
  private readonly busy = new Set<string>()
  private items: MemoryItem[] = []

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, 'memory')
    this.itemsFile = path.join(this.dir, 'items.json')
    mkdirSync(this.dir, { recursive: true })
    this.loadItems()
  }

  private loadItems(): void {
    if (existsSync(this.itemsFile)) {
      try {
        const raw = JSON.parse(readFileSync(this.itemsFile, 'utf8')) as MemoryItem[]
        if (Array.isArray(raw)) {
          this.items = raw
          return
        }
      } catch {
        // start empty
      }
    }
    // Seed default structured memories if brand new
    this.items = [
      {
        id: randomUUID(),
        scope: 'shared',
        category: 'preference',
        title: 'Language Preference',
        content: 'Primary interaction language is natural Bangla. Maintain clear professional Bengali responses.',
        updatedAt: Date.now(),
      },
      {
        id: randomUUID(),
        scope: 'lead-hunt',
        category: 'instruction',
        title: 'Lead Collection Standard',
        content: 'Target verified public businesses in Bangladesh. Collect business name, phone, website, and Facebook page without duplicates.',
        updatedAt: Date.now(),
      },
      {
        id: randomUUID(),
        scope: 'marketing',
        category: 'instruction',
        title: 'Marketing Outreach Protocol',
        content: 'Draft personalized, polite Bengali outreach messages. Never send outbound messages without explicit user approval.',
        updatedAt: Date.now(),
      },
    ]
    this.saveItems()
  }

  private saveItems(): void {
    try {
      const tmp = `${this.itemsFile}.tmp`
      writeFileSync(tmp, JSON.stringify(this.items, null, 2), 'utf8')
      renameSync(tmp, this.itemsFile)
    } catch {
      // non-critical
    }
  }

  list(scope?: 'lead-hunt' | 'marketing' | 'shared'): MemoryItem[] {
    if (!scope) return [...this.items]
    return this.items.filter((item) => item.scope === scope || item.scope === 'shared')
  }

  add(input: {
    scope: 'lead-hunt' | 'marketing' | 'shared'
    category: 'preference' | 'instruction' | 'fact' | 'history' | 'task'
    title: string
    content: string
  }): MemoryItem {
    const item: MemoryItem = {
      id: randomUUID(),
      scope: input.scope,
      category: input.category,
      title: input.title.trim().slice(0, 150),
      content: input.content.trim().slice(0, 2000),
      updatedAt: Date.now(),
    }
    this.items.unshift(item)
    this.saveItems()
    return item
  }

  updateItem(id: string, partial: Partial<Omit<MemoryItem, 'id'>>): MemoryItem | undefined {
    const idx = this.items.findIndex((m) => m.id === id)
    if (idx === -1) return undefined
    const existing = this.items[idx]
    if (!existing) return undefined
    const updated: MemoryItem = {
      id: existing.id,
      scope: partial.scope ?? existing.scope,
      category: partial.category ?? existing.category,
      title: partial.title ?? existing.title,
      content: partial.content ?? existing.content,
      updatedAt: Date.now(),
    }
    this.items[idx] = updated
    this.saveItems()
    return updated
  }



  delete(id: string): boolean {
    const prev = this.items.length
    this.items = this.items.filter((m) => m.id !== id)
    if (this.items.length !== prev) {
      this.saveItems()
      return true
    }
    return false
  }

  clear(scope?: string): void {
    if (!scope) {
      this.items = []
    } else {
      this.items = this.items.filter((m) => m.scope !== scope)
      const f = this.file(scope)
      if (existsSync(f)) {
        try {
          unlinkSync(f)
        } catch {
          // ignore
        }
      }
    }
    this.saveItems()
  }


  search(query: string): MemoryItem[] {
    const q = query.toLowerCase().trim()
    if (!q) return this.list()
    return this.items.filter((m) => m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q))
  }

  file(agentId: string): string {
    return path.join(this.dir, `${agentId}.md`)
  }

  read(agentId: string): string {
    const f = this.file(agentId)
    return existsSync(f) ? readFileSync(f, 'utf8') : ''
  }

  write(agentId: string, text: string): void {
    const f = this.file(agentId)
    const tmp = `${f}.tmp`
    writeFileSync(tmp, text.trim().slice(0, MAX_CHARS * 2), 'utf8')
    renameSync(tmp, f)
  }

  /**
   * Retrieves relevant memory context for the agent and turn query.
   */
  getRelevantContext(agentId: string, queryText = ''): string {
    const scope = agentId === 'marketing' ? 'marketing' : 'lead-hunt'
    const candidates = this.list(scope)
    if (candidates.length === 0) return ''

    // Rank candidates by term overlap if query is provided
    const words = queryText.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const scored = candidates.map((item) => {
      let score = item.scope === 'shared' ? 1 : 2
      const text = `${item.title} ${item.content}`.toLowerCase()
      for (const w of words) {
        if (text.includes(w)) score += 3
      }
      return { item, score }
    })

    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, 5).map((s) => s.item)

    return top
      .map((item) => `• [${item.category.toUpperCase()}] ${item.title}: ${item.content}`)
      .join('\n')
  }

  /**
   * Update long-term memory notes from conversation history. Completely local and autonomous.
   */
  async update(team: Team, agent: Agent, recent: Message[]): Promise<void> {
    if (this.busy.has(agent.id) || recent.length === 0) return
    this.busy.add(agent.id)
    try {
      const names = new Map<string, string>([['user', team.owner.name]])
      for (const a of team.agents) names.set(a.id, a.name)
      const transcript = recent
        .filter((m) => m.status === 'done' && m.text.trim())
        .slice(-8)
        .map((m) => `- [${names.get(m.authorId) ?? m.authorId}]: ${m.text.replace(/\s+/g, ' ').slice(0, 400)}`)
        .join('\n')

      const current = this.read(agent.id)
      const combined = [current.trim(), transcript ? `Recent activity record:\n${transcript}` : '']
        .filter(Boolean)
        .join('\n\n')
        .slice(-MAX_CHARS)

      this.write(agent.id, combined)
    } finally {
      this.busy.delete(agent.id)
    }
  }
}
