import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PermissionsEngine } from './permissions.js'
import { AuditLogger } from './audit.js'
import { EmergencyStopManager } from './emergency.js'
import { WhatsAppService } from './whatsapp.js'

function makeTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'ogb-test-'))
}

test('PermissionsEngine enforces owner security boundaries and blocks bot self-modification', () => {
  const tmp = makeTempDir()
  try {
    const audit = new AuditLogger(tmp)
    const engine = new PermissionsEngine(tmp, audit)

    // Rule 1 & 2: Bot self-modification of security config is blocked
    const denyRes = engine.evaluate('write_file', { file_path: 'data/permissions.json', content: '{}' })
    assert.equal(denyRes.verdict, 'deny')
    assert.equal(denyRes.isSelfModificationAttempt, true)

    // Rule 5: Credential lookup triggers explicit ask
    const credRes = engine.evaluate('Read', { file_path: 'C:/Users/Windows/.env' })
    assert.equal(credRes.verdict, 'ask')
    assert.equal(credRes.category, 'credential.access')

    // Rule 5: Destructive deletion triggers ask
    const delRes = engine.evaluate('terminal_exec', { command: 'rm -rf /some/dir' })
    assert.equal(delRes.verdict, 'ask')
    assert.equal(delRes.category, 'file.delete')

    // Section 5 Critical Override: WhatsApp autonomous messaging allowed without per-message confirmation
    const waAutoRes = engine.evaluate('whatsapp_send', { phone: '123' }, undefined, 'growthifyx', true)
    assert.equal(waAutoRes.verdict, 'allow')
    assert.equal(waAutoRes.category, 'messaging.outbound')

    // WhatsApp when autonomous mode is disabled falls back to configured ask
    const waManualRes = engine.evaluate('whatsapp_send', { phone: '123' }, undefined, 'growthifyx', false)
    assert.equal(waManualRes.verdict, 'ask')

    // Routine operations (Outputs and Searches) are allowed
    const routineRes = engine.evaluate('write_to_file', { path: 'Documents/OpenGrokBot/Outputs/leads.csv' })
    assert.equal(routineRes.verdict, 'allow')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('AuditLogger scrubs sensitive credentials and records structured audit trail', () => {
  const tmp = makeTempDir()
  try {
    const audit = new AuditLogger(tmp)
    audit.record({
      brandId: 'growthifyx',
      category: 'credential.access',
      tool: 'inspect_token',
      actionSummary: 'Used bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and EAAB1234567890abcdef',
      decision: 'denied',
      reason: 'api_key=sk-proj-1234567890abcdef123456 was present',
    })

    const logs = audit.list({ brandId: 'growthifyx' })
    assert.equal(logs.length, 1)
    const entry = logs[0]
    assert.ok(entry, 'Entry should exist')
    assert.ok(!entry.actionSummary.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'Bearer token must be scrubbed')
    assert.ok(entry.actionSummary.includes('[REDACTED_TOKEN]'))
    assert.ok(entry.actionSummary.includes('[REDACTED_META_TOKEN]'))
    assert.ok(entry.reason?.includes('[REDACTED_API_KEY]'))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('EmergencyStopManager halts rounds, cancels tasks, rejects approvals, and resumes', () => {
  const tmp = makeTempDir()
  try {
    let roundsStopped = 0
    let tasksCancelled = 0
    let approvalsRejected = 0
    let whatsappPaused = false

    const mockOrchestrator: any = {
      stopAll: () => {
        roundsStopped = 3
        return 3
      },
      stop: () => {},
    }
    const mockTasks: any = {
      cancelAll: () => {
        tasksCancelled = 5
        return 5
      },
      cancel: () => {},
    }
    const mockApprovals: any = {
      rejectAll: () => {
        approvalsRejected = 2
        return 2
      },
    }
    const mockWhatsapp: any = {
      pauseAll: () => {
        whatsappPaused = true
      },
      resumeAll: () => {
        whatsappPaused = false
      },
    }

    const audit = new AuditLogger(tmp)
    const emergency = new EmergencyStopManager(
      () => mockOrchestrator,
      () => mockTasks,
      () => mockApprovals,
      () => mockWhatsapp,
      audit
    )

    assert.equal(emergency.getState().active, false)

    // Trigger Emergency Stop
    const stoppedState = emergency.trigger('all', 'Owner hit Emergency button')
    assert.equal(stoppedState.active, true)
    assert.equal(roundsStopped, 3)
    assert.equal(tasksCancelled, 5)
    assert.equal(approvalsRejected, 2)
    assert.equal(whatsappPaused, true)

    // Resume
    const resumedState = emergency.resume()
    assert.equal(resumedState.active, false)
    assert.equal(whatsappPaused, false)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('WhatsAppService detects opt-out, human handover, and queues messages in setup mode', async () => {
  const tmp = makeTempDir()
  try {
    const audit = new AuditLogger(tmp)
    const wa = new WhatsAppService(tmp, audit)

    // Outbound send in setup_required mode
    const outRes = await wa.sendOutboundMessage({
      brandId: 'growthifyx',
      recipientPhone: '+8801700000000',
      message: 'Hello from OpenGrokBot',
    })
    assert.equal(outRes.ok, true)
    assert.equal(outRes.status, 'queued')

    // Webhook opt-out check
    const optOutPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: 'msg-1', from: '8801700000000', text: { body: 'বন্ধ করুন' } }],
              },
            },
          ],
        },
      ],
    }
    const optOutRes = await wa.handleIncomingWebhook(optOutPayload)
    assert.equal(optOutRes.handled, true)
    assert.equal(optOutRes.repliesSent, 1)

    // Webhook human handover check
    const handoverPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: 'msg-2', from: '8801700000000', text: { body: 'আমি মানুষের সাথে কথা বলতে চাই' } }],
              },
            },
          ],
        },
      ],
    }
    const handoverRes = await wa.handleIncomingWebhook(handoverPayload)
    assert.equal(handoverRes.handled, true)
    const messages = wa.listMessages('growthifyx')
    const handoverMsg = messages.find((m) => m.id === 'msg-2')
    assert.equal(handoverMsg?.humanHandoverRequired, true)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
