import type { EmergencyStopState } from '../shared/types.js'
import type { Orchestrator } from './orchestrator.js'
import type { TaskManager } from './tasks.js'
import type { Approvals } from './approvals.js'
import type { WhatsAppService } from './whatsapp.js'
import type { AuditLogger } from './audit.js'
import { emit } from './events.js'

export class EmergencyStopManager {
  private state: EmergencyStopState = {
    active: false,
    stoppedTasksCount: 0,
    stoppedRoundsCount: 0,
  }

  constructor(
    private readonly getOrchestrator: () => Orchestrator | undefined,
    private readonly getTasks: () => TaskManager | undefined,
    private readonly getApprovals: () => Approvals | undefined,
    private readonly getWhatsApp: () => WhatsAppService | undefined,
    private readonly audit?: AuditLogger
  ) {}

  getState(): EmergencyStopState {
    return { ...this.state }
  }

  trigger(
    scope: 'all' | 'task' | 'bot' | 'pause' = 'all',
    reason = 'Owner triggered Emergency Stop',
    targetId?: string
  ): EmergencyStopState {
    let stoppedTasks = 0
    let stoppedRounds = 0

    const orchestrator = this.getOrchestrator()
    const tasks = this.getTasks()
    const approvals = this.getApprovals()
    const whatsapp = this.getWhatsApp()

    if (scope === 'all' || scope === 'pause') {
      // 1. Abort all active conversation rounds
      if (orchestrator) {
        stoppedRounds = orchestrator.stopAll()
      }

      // 2. Cancel all running and queued tasks
      if (tasks) {
        stoppedTasks = tasks.cancelAll()
      }

      // 3. Reject all pending approval requests
      if (approvals) {
        approvals.rejectAll()
      }

      // 4. Halt autonomous WhatsApp dispatch
      if (whatsapp) {
        whatsapp.pauseAll()
      }
    } else if (scope === 'task' && targetId && tasks) {
      tasks.cancel(targetId)
      stoppedTasks = 1
    } else if (scope === 'bot' && targetId && orchestrator) {
      orchestrator.stop(targetId)
      stoppedRounds = 1
    }

    this.state = {
      active: true,
      stoppedAt: Date.now(),
      scope,
      reason,
      stoppedTasksCount: stoppedTasks,
      stoppedRoundsCount: stoppedRounds,
    }

    this.audit?.record({
      category: 'security.config',
      tool: 'EmergencyStopManager',
      actionSummary: `EMERGENCY STOP [${scope.toUpperCase()}]: ${reason} (Stopped ${stoppedTasks} tasks, ${stoppedRounds} rounds)`,
      decision: 'approved',
      reason: 'Owner Emergency Stop intervention',
    })

    return this.getState()
  }

  resume(): EmergencyStopState {
    const whatsapp = this.getWhatsApp()
    if (whatsapp) {
      whatsapp.resumeAll()
    }

    this.state = {
      active: false,
      stoppedTasksCount: 0,
      stoppedRoundsCount: 0,
      reason: 'Resumed by owner',
    }

    this.audit?.record({
      category: 'security.config',
      tool: 'EmergencyStopManager',
      actionSummary: 'Owner resumed system execution from Emergency Stop.',
      decision: 'approved',
      reason: 'Owner resumed system',
    })

    return this.getState()
  }
}
