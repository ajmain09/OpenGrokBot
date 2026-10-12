import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Orchestrator } from './orchestrator.js'
import type { Approvals } from './approvals.js'
import type { BotTask } from '../shared/types.js'

export class TaskManager {
  private readonly file: string
  private tasks: BotTask[] = []
  private activeAbortControllers = new Map<string, AbortController>()

  constructor(
    dataDir: string,
    private readonly getOrchestrator: () => Orchestrator | undefined,
    private readonly getApprovals?: () => Approvals | undefined
  ) {
    this.file = path.join(dataDir, 'tasks.json')
    mkdirSync(dataDir, { recursive: true })
    this.load()
    this.reconcileOnStartup()
  }

  private load(): void {
    if (existsSync(this.file)) {
      try {
        const raw = JSON.parse(readFileSync(this.file, 'utf8')) as BotTask[]
        if (Array.isArray(raw)) {
          this.tasks = raw
          return
        }
      } catch {
        // empty
      }
    }
    this.tasks = []
  }

  private save(): void {
    try {
      const tmp = `${this.file}.tmp`
      writeFileSync(tmp, JSON.stringify(this.tasks.slice(-150), null, 2), 'utf8')
      renameSync(tmp, this.file)
    } catch {
      // non-critical
    }
  }

  private reconcileOnStartup(): void {
    let changed = false
    for (const t of this.tasks) {
      if (t.status === 'running') {
        t.status = 'failed'
        t.error = 'Process interrupted when application was restarted. Click Retry to run again.'
        t.logs.push(`[${new Date().toLocaleTimeString()}] Interrupted by application restart.`)
        changed = true
      }
    }
    if (changed) this.save()
  }

  list(brandId?: string): BotTask[] {
    const all = [...this.tasks].sort((a, b) => b.createdAt - a.createdAt)
    if (brandId && brandId !== 'all') {
      return all.filter((t) => !t.brandId || t.brandId === brandId)
    }
    return all
  }

  get(id: string): BotTask | undefined {
    return this.tasks.find((t) => t.id === id)
  }

  create(input: {
    brandId?: string
    workspace: 'workspace-lead-hunt' | 'workspace-marketing'
    title: string
    prompt: string
  }): BotTask {
    const task: BotTask = {
      id: randomUUID(),
      brandId: input.brandId,
      title: input.title.trim().slice(0, 150) || 'Background AI Task',
      workspace: input.workspace,
      status: 'queued',
      prompt: input.prompt.trim(),
      logs: [`[${new Date().toLocaleTimeString()}] Task queued.`],
      createdAt: Date.now(),
    }
    this.tasks.unshift(task)
    this.save()

    // Trigger execution
    void this.runTask(task.id)
    return task
  }

  async runTask(id: string): Promise<void> {
    const task = this.get(id)
    if (!task || task.status === 'running') return

    const orch = this.getOrchestrator()
    if (!orch) {
      task.status = 'failed'
      task.error = 'Orchestrator not ready'
      task.logs.push(`[${new Date().toLocaleTimeString()}] Error: Orchestrator unavailable.`)
      this.save()
      return
    }

    task.status = 'running'
    task.startedAt = Date.now()
    task.progress = 'Starting workspace turn…'
    task.logs.push(`[${new Date().toLocaleTimeString()}] Execution started in ${task.workspace}.`)
    this.save()

    const abort = new AbortController()
    this.activeAbortControllers.set(id, abort)

    try {
      // Post prompt to the target workspace
      orch.post(task.workspace, task.prompt, {
        authorId: 'user',
        note: `[Task Manager Job: ${task.title}] Execute this task thoroughly with your tools and output the final result.`,
      })

      task.progress = 'Running tools in background…'
      task.logs.push(`[${new Date().toLocaleTimeString()}] Prompt dispatched to agent.`)
      this.save()

      // Poll workspace busy status until turn completes
      const checkInterval = 2000
      const maxWait = 15 * 60_000 // 15 mins timeout
      const startWait = Date.now()

      await new Promise<void>((resolve, reject) => {
        const timer = setInterval(() => {
          if (abort.signal.aborted) {
            clearInterval(timer)
            reject(new Error('Task was cancelled by user'))
            return
          }

          const busy = orch.isBusy(task.workspace)
          if (!busy) {
            clearInterval(timer)
            resolve()
            return
          }

          if (Date.now() - startWait > maxWait) {
            clearInterval(timer)
            reject(new Error('Task timed out after 15 minutes'))
            return
          }

          const isWaitingAppr = this.getApprovals?.()?.list().some((a) => a.conversationId === task.workspace)
          if (isWaitingAppr) {
            task.status = 'waiting-approval'
            task.progress = 'Waiting for owner approval in Approval Center…'
          } else if (task.status === 'waiting-approval') {
            task.status = 'running'
            task.progress = 'Running tools in background…'
          } else {
            task.logs.push(`[${new Date().toLocaleTimeString()}] Agent working…`)
          }
          this.save()
        }, checkInterval)
      })

      task.status = 'completed'
      task.completedAt = Date.now()
      task.progress = 'Finished'
      task.resultSummary = 'Completed successfully. Check workspace chat for output details.'
      task.logs.push(`[${new Date().toLocaleTimeString()}] Task completed successfully.`)
    } catch (err) {
      if (abort.signal.aborted) {
        task.status = 'cancelled'
        task.logs.push(`[${new Date().toLocaleTimeString()}] Task was cancelled.`)
      } else {
        task.status = 'failed'
        task.error = err instanceof Error ? err.message : String(err)
        task.logs.push(`[${new Date().toLocaleTimeString()}] Task failed: ${task.error}`)
      }
    } finally {
      this.activeAbortControllers.delete(id)
      this.save()
    }
  }

  cancel(id: string): boolean {
    const task = this.get(id)
    if (!task) return false

    const abort = this.activeAbortControllers.get(id)
    if (abort) {
      abort.abort()
      this.activeAbortControllers.delete(id)
    }

    if (task.status === 'queued' || task.status === 'running') {
      task.status = 'cancelled'
      task.completedAt = Date.now()
      task.logs.push(`[${new Date().toLocaleTimeString()}] Cancelled by user.`)
      this.save()
      return true
    }
    return false
  }

  cancelAll(): number {
    let count = 0
    for (const task of this.tasks) {
      if (task.status === 'queued' || task.status === 'running' || task.status === 'waiting-approval') {
        const abort = this.activeAbortControllers.get(task.id)
        if (abort) abort.abort()
        task.status = 'cancelled'
        task.completedAt = Date.now()
        task.logs.push(`[${new Date().toLocaleTimeString()}] Cancelled by Emergency Stop.`)
        count++
      }
    }
    this.activeAbortControllers.clear()
    this.save()
    return count
  }

  retry(id: string): boolean {
    const task = this.get(id)
    if (!task) return false
    task.status = 'queued'
    task.error = undefined
    task.progress = undefined
    task.logs.push(`[${new Date().toLocaleTimeString()}] Retrying task…`)
    this.save()
    void this.runTask(id)
    return true
  }

  delete(id: string): boolean {
    const prev = this.tasks.length
    this.tasks = this.tasks.filter((t) => t.id !== id)
    if (this.tasks.length !== prev) {
      this.save()
      return true
    }
    return false
  }

  clearFinished(): void {
    this.tasks = this.tasks.filter((t) => t.status === 'running' || t.status === 'queued')
    this.save()
  }
}
