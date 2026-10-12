import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Workflow } from '../shared/types.js'

const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-lead-to-outreach',
    brandId: 'growthifyx',
    title: 'Lead Discovery to Outreach Pipeline',
    description: 'Auto-research verified café & agency leads in Dhaka and prepare personalized Bengali outreach drafts.',
    createdAt: Date.now(),
    steps: [
      {
        id: 's1',
        agentId: 'lead_collection_specialist',
        title: 'Collect 10 Verified Leads',
        prompt: 'Research and collect 10 verified business leads in Dhaka. Deduplicate and save to database.',
        workspace: 'workspace-lead-hunt',
      },
      {
        id: 's2',
        agentId: 'marketing',
        title: 'Draft Personalized Messages',
        prompt: 'Review newly collected leads and prepare customized polite Bengali marketing drafts for each.',
        workspace: 'workspace-marketing',
      },
    ],
  },
  {
    id: 'wf-business-audit',
    brandId: 'the-solver-agency',
    title: 'Client Business Opportunity Audit',
    description: 'Investigate target company digital presence and draft software automation proposal.',
    createdAt: Date.now(),
    steps: [
      {
        id: 's1',
        agentId: 'business_researcher',
        title: 'Market & Competitor Analysis',
        prompt: 'Analyze public website, offerings, and competitive gaps for target company.',
        workspace: 'workspace-lead-hunt',
      },
      {
        id: 's2',
        agentId: 'windows_operator',
        title: 'Compile Proposal & Save Report',
        prompt: 'Compile structured proposal document into Outputs folder.',
        workspace: 'workspace-lead-hunt',
      },
    ],
  },
]

export class WorkflowsStore {
  private readonly file: string
  private workflows: Workflow[] = []

  constructor(workspaceDir: string) {
    const dataDir = path.join(workspaceDir, 'data')
    mkdirSync(dataDir, { recursive: true })
    this.file = path.join(dataDir, 'workflows.json')
    this.load()
  }

  private load(): void {
    if (existsSync(this.file)) {
      try {
        const raw = readFileSync(this.file, 'utf8')
        this.workflows = JSON.parse(raw) as Workflow[]
        if (this.workflows.length > 0) return
      } catch {
        // fallback
      }
    }
    this.workflows = [...DEFAULT_WORKFLOWS]
    this.save()
  }

  private save(): void {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.workflows, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }

  list(brandId?: string): Workflow[] {
    if (!brandId) return [...this.workflows]
    return this.workflows.filter((w) => !w.brandId || w.brandId === brandId)
  }

  get(id: string): Workflow | undefined {
    return this.workflows.find((w) => w.id === id)
  }

  create(input: Omit<Workflow, 'id' | 'createdAt'> & { id?: string }): Workflow {
    const id = input.id || `wf-${Date.now()}`
    const wf: Workflow = {
      ...input,
      id,
      createdAt: Date.now(),
    }
    this.workflows.push(wf)
    this.save()
    return wf
  }

  update(id: string, patch: Partial<Workflow>): Workflow {
    const idx = this.workflows.findIndex((w) => w.id === id)
    if (idx === -1) throw new Error(`Workflow not found: ${id}`)
    const existing = this.workflows[idx]
    if (!existing) throw new Error(`Workflow not found: ${id}`)
    const updated: Workflow = { ...existing, ...patch, id: existing.id }
    this.workflows[idx] = updated
    this.save()
    return updated
  }

  delete(id: string): boolean {
    const before = this.workflows.length
    this.workflows = this.workflows.filter((w) => w.id !== id)
    if (this.workflows.length !== before) {
      this.save()
      return true
    }
    return false
  }
}

