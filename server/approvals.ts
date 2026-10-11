import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { emit } from './events.js'
import type { Agent, ApprovalHistoryItem, ApprovalRequest, AutoReviewRule, Team } from '../shared/types.js'

const DANGEROUS = new Set(['Bash', 'Write', 'Edit', 'NotebookEdit'])
const TIMEOUT_MS = 10 * 60_000

interface Pending {
  request: ApprovalRequest
  resolve: (allowed: boolean) => void
  timer: NodeJS.Timeout
}

/** Which tools must stop for the owner, given the employee's policy. Others are auto-allowed. */
export function toolsNeedingApproval(agent: Agent): Set<string> | 'all' | 'none' {
  if (agent.approvals === 'ask-all') return 'all'
  if (agent.approvals === 'ask-dangerous') return DANGEROUS
  return 'none'
}

export function isSafeTrustedOperation(tool: string, input: Record<string, unknown>): { safe: boolean; reason?: string } {
  // Read operations are completely safe
  if (tool === 'Read' || tool === 'Glob' || tool === 'Grep' || tool === 'view_file') {
    return { safe: true, reason: 'Read-only workspace file access' }
  }
  // Web search and fetch are safe
  if (tool === 'WebSearch' || tool === 'WebFetch' || tool === 'search_web' || tool === 'read_url_content') {
    return { safe: true, reason: 'Public web research and navigation' }
  }
  // Read-only browser navigation and inspection
  if (
    tool === 'mcp__playwright__browser_navigate' ||
    tool === 'mcp__playwright__browser_snapshot' ||
    tool === 'mcp__playwright__browser_wait_for' ||
    tool === 'mcp__playwright__browser_tabs'
  ) {
    return { safe: true, reason: 'Safe browser page navigation and view' }
  }
  // Safe reviewed scripts
  if (tool === 'Bash' || tool === 'run_command') {
    const cmd = ((input.command as string) ?? (input.CommandLine as string) ?? '').trim()
    const safePrefixes = [
      'npm run typecheck',
      'npm test',
      'npm run build',
      'node scripts/build-verify.js',
      'git status',
      'git log',
      'git diff',
      'dir',
      'Get-ChildItem',
    ]
    if (safePrefixes.some((p) => cmd.startsWith(p))) {
      return { safe: true, reason: `Trusted project command: ${cmd.slice(0, 50)}` }
    }
  }
  // Writing to outputs or data
  if (tool === 'Write' || tool === 'write_file' || tool === 'write_to_file' || tool === 'replace_file_content') {
    const filePath = ((input.file_path as string) ?? (input.path as string) ?? (input.TargetFile as string) ?? '')
    if (
      filePath.includes('Outputs') ||
      filePath.includes('data\\leads') ||
      filePath.includes('data/leads') ||
      filePath.includes('data\\memory') ||
      filePath.includes('data/memory')
    ) {
      return { safe: true, reason: 'Saving output/lead data file' }
    }
  }
  return { safe: false }
}

export function needsApproval(agent: Agent, tool: string): boolean {
  const set = toolsNeedingApproval(agent)
  if (set === 'none') return false
  if (set === 'all') return true
  return set.has(tool) || tool.startsWith('mcp__')
}

function ruleMatches(rule: AutoReviewRule, tool: string, inputText: string): boolean {
  if (rule.tool !== '*' && rule.tool.toLowerCase() !== tool.toLowerCase()) return false
  if (rule.match && !inputText.toLowerCase().includes(rule.match.toLowerCase())) return false
  return true
}

/** Personal auto-review: "require" beats "allow"; no rule → ask. */
export function reviewByRules(team: Team, tool: string, input: Record<string, unknown>): 'allow' | 'require' | 'ask' {
  const text = JSON.stringify(input)
  const hits = team.settings.autoReview.filter((r) => ruleMatches(r, tool, text))
  if (hits.some((r) => r.action === 'require')) return 'require'
  if (hits.some((r) => r.action === 'allow')) return 'allow'
  return 'ask'
}

export function summarizeInput(tool: string, input: Record<string, unknown>): string {
  const s = (k: string): string => (typeof input[k] === 'string' ? (input[k] as string) : '')
  switch (tool) {
    case 'Bash':
      return s('description') ? `${s('description')} — ${s('command')}` : s('command')
    case 'Write':
    case 'Edit':
    case 'Read':
    case 'NotebookEdit':
      return s('file_path')
    case 'run_command':
      return s('command') || s('CommandLine')
    case 'write_file':
    case 'edit_file':
      return s('path')
    case 'write_to_file':
    case 'replace_file_content':
      return s('TargetFile')
    default:
      return JSON.stringify(input).slice(0, 300)
  }
}

/** Holds tool calls that wait for the owner's Allow / Deny in the chat, with auto-approval & persistent history. */
export class Approvals {
  private readonly pending = new Map<string, Pending>()
  private readonly historyItems: ApprovalHistoryItem[] = []
  private readonly historyFile: string

  constructor(dataDir = path.join(process.cwd(), 'data')) {
    mkdirSync(dataDir, { recursive: true })
    this.historyFile = path.join(dataDir, 'approval-history.json')
    this.loadHistory()
  }

  private loadHistory(): void {
    if (existsSync(this.historyFile)) {
      try {
        const raw = JSON.parse(readFileSync(this.historyFile, 'utf8')) as ApprovalHistoryItem[]
        if (Array.isArray(raw)) {
          this.historyItems.push(...raw.slice(-200))
        }
      } catch {
        // start empty
      }
    }
  }

  private saveHistory(): void {
    try {
      writeFileSync(this.historyFile, JSON.stringify(this.historyItems.slice(-200), null, 2))
    } catch {
      // non-critical
    }
  }

  list(): ApprovalRequest[] {
    return [...this.pending.values()].map((p) => p.request)
  }

  getHistory(): ApprovalHistoryItem[] {
    return [...this.historyItems].reverse()
  }

  clearHistory(): void {
    this.historyItems.length = 0
    this.saveHistory()
  }

  /** Resolves true (allowed) or false (denied or timed out). Automatically allows trusted safe operations. */
  ask(conversationId: string, agentId: string, tool: string, input: Record<string, unknown>, signal: AbortSignal): Promise<boolean> {
    const summary = summarizeInput(tool, input)
    const trusted = isSafeTrustedOperation(tool, input)

    if (trusted.safe) {
      this.historyItems.push({
        id: randomUUID(),
        conversationId,
        agentId,
        tool,
        summary,
        status: 'auto-approved',
        autoRule: trusted.reason,
        timestamp: Date.now(),
      })
      this.saveHistory()
      return Promise.resolve(true)
    }

    const request: ApprovalRequest = {
      id: randomUUID(),
      conversationId,
      agentId,
      tool,
      summary,
      input,
      createdAt: Date.now(),
    }

    return new Promise<boolean>((resolve) => {
      const finish = (allowed: boolean): void => {
        const p = this.pending.get(request.id)
        if (!p) return
        clearTimeout(p.timer)
        this.pending.delete(request.id)
        signal.removeEventListener('abort', onAbort)
        
        this.historyItems.push({
          id: request.id,
          conversationId,
          agentId,
          tool,
          summary,
          status: allowed ? 'approved' : 'rejected',
          timestamp: Date.now(),
        })
        this.saveHistory()

        emit({ type: 'approval:resolved', id: request.id, allowed })
        resolve(allowed)
      }
      const onAbort = (): void => finish(false)
      const timer = setTimeout(() => finish(false), TIMEOUT_MS)
      this.pending.set(request.id, { request, resolve: finish, timer })
      signal.addEventListener('abort', onAbort, { once: true })
      emit({ type: 'approval:request', request })
    })
  }

  resolve(id: string, allowed: boolean): ApprovalRequest | undefined {
    const p = this.pending.get(id)
    if (!p) return undefined
    p.resolve(allowed)
    return p.request
  }
}
