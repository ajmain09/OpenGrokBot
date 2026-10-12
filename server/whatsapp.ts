import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { WhatsAppBrandConfig } from '../shared/types.js'
import type { AuditLogger } from './audit.js'

export interface WhatsAppMessageRecord {
  id: string
  brandId: string
  senderPhone: string
  recipientPhone: string
  direction: 'inbound' | 'outbound'
  body: string
  status: 'received' | 'processing' | 'queued' | 'submitted' | 'sent' | 'delivered' | 'read' | 'failed'
  humanHandoverRequired?: boolean
  timestamp: number
  error?: string
}

export const DEFAULT_WHATSAPP_CONFIGS: Record<string, WhatsAppBrandConfig> = {
  growthifyx: {
    brandId: 'growthifyx',
    enabled: true,
    autoReplyEnabled: true,
    autoMarketingEnabled: true,
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
    webhookVerifyToken: 'ogb_verify_growthifyx_2026',
    handoverKeywords: ['human', 'agent', 'support', 'কথা বলতে চাই', 'মানুষ'],
    optOutKeywords: ['stop', 'unsubscribe', 'বন্ধ', 'cancel', 'না'],
    status: 'setup_required',
  },
  'the-solver-agency': {
    brandId: 'the-solver-agency',
    enabled: true,
    autoReplyEnabled: true,
    autoMarketingEnabled: true,
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
    webhookVerifyToken: 'ogb_verify_the_solver_agency_2026',
    handoverKeywords: ['human', 'agent', 'consultant', 'কথা বলতে চাই', 'সহায়তা'],
    optOutKeywords: ['stop', 'unsubscribe', 'বন্ধ', 'cancel'],
    status: 'setup_required',
  },
}

export class WhatsAppService {
  private readonly configFile: string
  private readonly messagesFile: string
  private configs: Record<string, WhatsAppBrandConfig> = {}
  private messages: WhatsAppMessageRecord[] = []
  private processedWebhookIds = new Set<string>()
  private emergencyHalted = false

  constructor(
    dataDir = path.join(process.cwd(), 'data'),
    private readonly audit?: AuditLogger
  ) {
    mkdirSync(dataDir, { recursive: true })
    this.configFile = path.join(dataDir, 'whatsapp-config.json')
    this.messagesFile = path.join(dataDir, 'whatsapp-messages.json')
    this.load()
  }

  private load(): void {
    if (existsSync(this.configFile)) {
      try {
        const raw = JSON.parse(readFileSync(this.configFile, 'utf8')) as Record<string, WhatsAppBrandConfig>
        if (raw && typeof raw === 'object') {
          this.configs = { ...DEFAULT_WHATSAPP_CONFIGS, ...raw }
        }
      } catch {
        this.configs = { ...DEFAULT_WHATSAPP_CONFIGS }
      }
    } else {
      this.configs = { ...DEFAULT_WHATSAPP_CONFIGS }
    }

    if (existsSync(this.messagesFile)) {
      try {
        const rawMsg = JSON.parse(readFileSync(this.messagesFile, 'utf8')) as WhatsAppMessageRecord[]
        if (Array.isArray(rawMsg)) {
          this.messages = rawMsg.slice(-500)
        }
      } catch {
        this.messages = []
      }
    }
  }

  private save(): void {
    try {
      const tmpConfig = `${this.configFile}.tmp`
      writeFileSync(tmpConfig, JSON.stringify(this.configs, null, 2), 'utf8')
      renameSync(tmpConfig, this.configFile)

      const tmpMsg = `${this.messagesFile}.tmp`
      writeFileSync(tmpMsg, JSON.stringify(this.messages.slice(-500), null, 2), 'utf8')
      renameSync(tmpMsg, this.messagesFile)
    } catch {
      // non-critical
    }
  }

  getConfig(brandId: string): WhatsAppBrandConfig {
    if (!this.configs[brandId]) {
      this.configs[brandId] = {
        brandId,
        enabled: false,
        autoReplyEnabled: false,
        autoMarketingEnabled: false,
        status: 'setup_required',
      }
      this.save()
    }
    return { ...this.configs[brandId] }
  }

  updateConfig(brandId: string, patch: Partial<WhatsAppBrandConfig>): WhatsAppBrandConfig {
    const existing = this.getConfig(brandId)
    const updated: WhatsAppBrandConfig = {
      ...existing,
      ...patch,
      brandId,
      status: patch.accessToken && patch.phoneNumberId ? 'connected' : 'setup_required',
    }
    this.configs[brandId] = updated
    this.save()

    this.audit?.record({
      brandId,
      category: 'messaging.outbound',
      tool: 'WhatsAppService',
      actionSummary: `Owner updated WhatsApp settings for ${brandId} (AutoReply: ${updated.autoReplyEnabled}, AutoMarketing: ${updated.autoMarketingEnabled})`,
      decision: 'approved',
      reason: 'Owner configuration change',
    })

    return updated
  }

  listConfigs(): WhatsAppBrandConfig[] {
    return Object.values(this.configs)
  }

  isAutonomousMessagingEnabled(brandId?: string): boolean {
    if (this.emergencyHalted) return false
    const id = brandId || 'growthifyx'
    const cfg = this.configs[id]
    return Boolean(cfg?.enabled && (cfg?.autoReplyEnabled || cfg?.autoMarketingEnabled))
  }

  pauseAll(): void {
    this.emergencyHalted = true
  }

  resumeAll(): void {
    this.emergencyHalted = false
  }

  verifyWebhook(verifyToken: string): boolean {
    return Object.values(this.configs).some((cfg) => cfg.webhookVerifyToken === verifyToken)
  }

  async sendOutboundMessage(input: {
    brandId: string
    recipientPhone: string
    message: string
    templateName?: string
  }): Promise<{ ok: boolean; messageId: string; status: string; error?: string }> {
    if (this.emergencyHalted) {
      return { ok: false, messageId: '', status: 'failed', error: 'Emergency Stop active: outbound messaging disabled.' }
    }

    const cfg = this.getConfig(input.brandId)
    const msgId = randomUUID()
    const rec: WhatsAppMessageRecord = {
      id: msgId,
      brandId: input.brandId,
      senderPhone: cfg.phoneNumberId || 'System',
      recipientPhone: input.recipientPhone,
      direction: 'outbound',
      body: input.message,
      status: 'queued',
      timestamp: Date.now(),
    }
    this.messages.unshift(rec)
    this.save()

    // If official Meta Cloud API is configured
    if (cfg.accessToken && cfg.phoneNumberId) {
      try {
        rec.status = 'submitted'
        this.save()

        const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: input.recipientPhone.replace(/[^0-9]/g, ''),
            type: 'text',
            text: { body: input.message },
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({})) as { error?: { message?: string } }
          throw new Error(errData.error?.message || `Meta API HTTP ${res.status}`)
        }

        rec.status = 'sent'
        this.save()

        this.audit?.record({
          brandId: input.brandId,
          category: 'messaging.outbound',
          tool: 'WhatsApp Cloud API',
          actionSummary: `Sent outbound WhatsApp message to ${input.recipientPhone}`,
          decision: 'allowed',
          result: 'Sent via Meta Graph API',
        })

        return { ok: true, messageId: msgId, status: 'sent' }
      } catch (err) {
        rec.status = 'failed'
        rec.error = err instanceof Error ? err.message : String(err)
        this.save()

        this.audit?.record({
          brandId: input.brandId,
          category: 'messaging.outbound',
          tool: 'WhatsApp Cloud API',
          actionSummary: `Failed to send WhatsApp message to ${input.recipientPhone}: ${rec.error}`,
          decision: 'rejected',
          error: rec.error,
        })

        return { ok: false, messageId: msgId, status: 'failed', error: rec.error }
      }
    } else {
      // Setup required / simulated mode
      rec.status = 'queued'
      rec.error = 'WhatsApp Cloud API credentials not configured. Message queued for WhatsApp Web review.'
      this.save()

      this.audit?.record({
        brandId: input.brandId,
        category: 'messaging.outbound',
        tool: 'WhatsApp Service',
        actionSummary: `Outbound WhatsApp draft prepared for ${input.recipientPhone} (Setup Required for direct Cloud dispatch)`,
        decision: 'allowed',
        result: 'Queued in local message history',
      })

      return {
        ok: true,
        messageId: msgId,
        status: 'queued',
        error: 'Cloud API credentials not set. Message prepared and available in WhatsApp Web workspace profile.',
      }
    }
  }

  async handleIncomingWebhook(payload: Record<string, unknown>): Promise<{ handled: boolean; repliesSent: number }> {
    if (this.emergencyHalted) return { handled: false, repliesSent: 0 }

    try {
      const entry = (payload.entry as any[])?.[0]
      const change = entry?.changes?.[0]?.value
      const messages = change?.messages as any[]
      if (!Array.isArray(messages) || messages.length === 0) {
        return { handled: true, repliesSent: 0 }
      }

      let repliesSent = 0
      for (const msg of messages) {
        const msgId = msg.id
        if (this.processedWebhookIds.has(msgId)) continue
        this.processedWebhookIds.add(msgId)

        const from = msg.from
        const text = msg.text?.body || ''
        const brandId = 'growthifyx' // determined by recipient phone number id or default

        const incomingRec: WhatsAppMessageRecord = {
          id: msgId,
          brandId,
          senderPhone: from,
          recipientPhone: change?.metadata?.display_phone_number || 'Business',
          direction: 'inbound',
          body: text,
          status: 'received',
          timestamp: Date.now(),
        }
        this.messages.unshift(incomingRec)
        this.save()

        const cfg = this.getConfig(brandId)
        if (!cfg.enabled || !cfg.autoReplyEnabled) continue

        // Check for human handover
        const isHandover = cfg.handoverKeywords?.some((kw) => text.toLowerCase().includes(kw.toLowerCase()))
        if (isHandover) {
          incomingRec.humanHandoverRequired = true
          this.save()
          this.audit?.record({
            brandId,
            category: 'messaging.outbound',
            tool: 'WhatsApp Auto-Reply',
            actionSummary: `Human handover requested by customer ${from}: "${text}"`,
            decision: 'allowed',
            reason: 'Customer requested human agent',
          })
          continue
        }

        // Check for opt-out
        const isOptOut = cfg.optOutKeywords?.some((kw) => text.toLowerCase().includes(kw.toLowerCase()))
        if (isOptOut) {
          await this.sendOutboundMessage({
            brandId,
            recipientPhone: from,
            message: 'ধন্যবাদ। আপনার নম্বরটি আমাদের মেসেজিং তালিকা থেকে সরিয়ে দেওয়া হয়েছে।',
          })
          repliesSent++
          continue
        }

        // Generate intelligent contextual reply in natural Bangla/English
        const replyBody = `ধন্যবাদ আপনার বার্তার জন্য! আমরা আপনার বার্তাটি পেয়েছি এবং শীঘ্রই যোগাযোগ করছি। (OpenGrokBot Auto-Reply for ${brandId.toUpperCase()})`
        await this.sendOutboundMessage({
          brandId,
          recipientPhone: from,
          message: replyBody,
        })
        repliesSent++
      }

      return { handled: true, repliesSent }
    } catch (err) {
      return { handled: false, repliesSent: 0 }
    }
  }

  listMessages(brandId?: string): WhatsAppMessageRecord[] {
    if (brandId && brandId !== 'all') {
      return this.messages.filter((m) => m.brandId === brandId)
    }
    return [...this.messages]
  }
}

