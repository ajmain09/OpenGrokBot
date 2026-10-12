import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Agent, OwnerPermissionsConfig, PermissionCategory, PermissionLevel } from '../shared/types.js'
import type { AuditLogger } from './audit.js'

export const DEFAULT_PERMISSIONS: Record<PermissionCategory, PermissionLevel> = {
  'browser.read': 'allow',
  'browser.navigate': 'allow',
  'browser.form': 'allow',
  'file.read': 'allow',
  'file.write': 'allow',
  'file.delete': 'ask',
  'terminal.command': 'allow', // safe commands allow, destructive evaluated individually
  'windows.inspect': 'allow',
  'windows.control': 'allow',
  'app.launch': 'allow',
  'lead.database': 'allow',
  'memory.operate': 'allow',
  'api.external': 'allow',
  'messaging.outbound': 'ask', // Overridden if owner enables autonomous WhatsApp for a brand
  'finance.payment': 'ask',
  'security.config': 'ask',
  'credential.access': 'ask',
}

export interface PermissionEvaluation {
  verdict: PermissionLevel
  category: PermissionCategory
  reason: string
  actionSummary: string
  isSelfModificationAttempt?: boolean
}

export class PermissionsEngine {
  private readonly configFile: string
  private config: OwnerPermissionsConfig

  constructor(
    dataDir = path.join(process.cwd(), 'data'),
    private readonly audit?: AuditLogger
  ) {
    mkdirSync(dataDir, { recursive: true })
    this.configFile = path.join(dataDir, 'permissions.json')
    this.config = this.load()
  }

  private load(): OwnerPermissionsConfig {
    if (existsSync(this.configFile)) {
      try {
        const raw = JSON.parse(readFileSync(this.configFile, 'utf8')) as OwnerPermissionsConfig
        if (raw && typeof raw === 'object' && raw.defaults) {
          return {
            version: raw.version || 1,
            updatedAt: raw.updatedAt || Date.now(),
            defaults: { ...DEFAULT_PERMISSIONS, ...raw.defaults },
            overrides: raw.overrides || {},
          }
        }
      } catch {
        // use default
      }
    }
    return {
      version: 1,
      updatedAt: Date.now(),
      defaults: { ...DEFAULT_PERMISSIONS },
      overrides: {},
    }
  }

  private save(): void {
    try {
      const tmp = `${this.configFile}.tmp`
      writeFileSync(tmp, JSON.stringify(this.config, null, 2), 'utf8')
      renameSync(tmp, this.configFile)
    } catch {
      // non-critical
    }
  }

  getConfig(): OwnerPermissionsConfig {
    return { ...this.config }
  }

  /**
   * Only the application owner can update permissions.
   * Bots are prohibited from invoking this method.
   */
  updatePermissions(newDefaults: Record<string, PermissionLevel>, overrides?: Record<string, PermissionLevel>): OwnerPermissionsConfig {
    this.config = {
      version: this.config.version + 1,
      updatedAt: Date.now(),
      defaults: {
        ...this.config.defaults,
        ...(newDefaults as Record<PermissionCategory, PermissionLevel>),
      },
      overrides: overrides || this.config.overrides || {},
    }
    this.save()

    this.audit?.record({
      category: 'security.config',
      tool: 'PermissionsEngine',
      actionSummary: `Owner updated permission policy to Version ${this.config.version}`,
      decision: 'approved',
      reason: 'Owner authorization',
    })

    return this.getConfig()
  }

  /**
   * Evaluates the requested tool and arguments against owner policy.
   * Strict backend security rules apply regardless of prompt instructions.
   */
  evaluate(
    tool: string,
    input: Record<string, unknown>,
    agent?: Agent,
    brandId?: string,
    autonomousMessagingEnabled = false
  ): PermissionEvaluation {
    const s = (k: string): string => (typeof input[k] === 'string' ? (input[k] as string) : '')
    const inputStr = JSON.stringify(input)

    // RULE 1 & 2: Check for Bot self-modification of security / permission configs
    const isSecurityConfigAttempt =
      inputStr.includes('permissions.json') ||
      inputStr.includes('approval-history.json') ||
      inputStr.includes('audit-log.json') ||
      inputStr.includes('team.json') ||
      tool === 'update_permissions' ||
      tool === 'modify_security_rules'

    if (isSecurityConfigAttempt) {
      return {
        verdict: 'deny',
        category: 'security.config',
        reason: 'Bots are strictly forbidden from modifying security policies or permissions.',
        actionSummary: `Attempted modification of security configuration: ${tool}`,
        isSelfModificationAttempt: true,
      }
    }

    // RULE 5: Credential and Secrets Access Detection
    const isCredentialAttempt =
      /\.env\b|id_rsa\b|\btoken\b|\bpassword\b|\bsecret_key\b|\bapi_key\b/i.test(inputStr) &&
      !inputStr.includes('data\\memory') &&
      !inputStr.includes('data/memory')

    if (isCredentialAttempt) {
      return {
        verdict: 'ask',
        category: 'credential.access',
        reason: 'Explicit owner approval required to access credentials or secrets.',
        actionSummary: `Sensitive credential lookup: ${tool}`,
      }
    }

    // RULE 5: Financial transactions and payments
    const isFinancialAttempt =
      /\bpayment\b|\bpurchase\b|\bcheckout\b|\bcredit_card\b|\bmoney_transfer\b/i.test(inputStr) ||
      tool.includes('payment') ||
      tool.includes('finance')

    if (isFinancialAttempt) {
      return {
        verdict: 'ask',
        category: 'finance.payment',
        reason: 'Explicit owner approval required for financial transactions or purchases.',
        actionSummary: `Financial transaction request: ${tool}`,
      }
    }

    // RULE 5: Destructive File or Database Deletions
    const isDestructiveDeletion =
      tool === 'delete_file' ||
      tool === 'remove_file' ||
      /\brm\s+-[rf]+|\bdel\s+\/f|\bRemove-Item\s+-Recurse|\bDROP\s+TABLE|\bDROP\s+DATABASE/i.test(
        s('command') || s('CommandLine') || inputStr
      )

    if (isDestructiveDeletion) {
      return {
        verdict: 'ask',
        category: 'file.delete',
        reason: 'Explicit owner approval required for file or database deletion.',
        actionSummary: `Destructive file/database deletion: ${tool}`,
      }
    }

    // SECTION 5 CRITICAL OVERRIDE: WhatsApp and Outbound Messaging
    const isMessagingAttempt =
      tool.includes('whatsapp') ||
      tool.includes('send_message') ||
      tool.includes('outreach') ||
      /\bwhatsapp\.send\b|\bsms\.send\b|\bemail\.send\b/i.test(tool)

    if (isMessagingAttempt) {
      // If owner has enabled autonomous messaging for this brand account, AUTO ALLOW without per-message approval!
      if (autonomousMessagingEnabled) {
        return {
          verdict: 'allow',
          category: 'messaging.outbound',
          reason: 'Owner has authorized autonomous WhatsApp messaging for this brand account.',
          actionSummary: `Autonomous WhatsApp messaging for brand ${brandId || 'default'}`,
        }
      }
      return {
        verdict: this.config.defaults['messaging.outbound'] || 'ask',
        category: 'messaging.outbound',
        reason: 'Owner approval required for external messaging dispatch (autonomous mode is disabled).',
        actionSummary: `External messaging dispatch: ${tool}`,
      }
    }

    // RULE 3: Routine Trusted Operations (Safe Reads, Outputs, Searches)
    if (
      tool === 'Read' ||
      tool === 'Glob' ||
      tool === 'Grep' ||
      tool === 'view_file' ||
      tool === 'read_url_content'
    ) {
      return {
        verdict: 'allow',
        category: 'file.read',
        reason: 'Trusted read-only file/content inspection.',
        actionSummary: `Read: ${s('file_path') || s('TargetFile') || s('Url')}`,
      }
    }

    if (
      tool === 'WebSearch' ||
      tool === 'WebFetch' ||
      tool === 'search_web' ||
      tool.startsWith('mcp__playwright__browser_navigate') ||
      tool.startsWith('mcp__playwright__browser_snapshot')
    ) {
      return {
        verdict: 'allow',
        category: 'browser.navigate',
        reason: 'Trusted web research and navigation.',
        actionSummary: `Web navigation / search: ${s('query') || s('url') || tool}`,
      }
    }

    if (
      tool === 'Write' ||
      tool === 'write_file' ||
      tool === 'write_to_file' ||
      tool === 'replace_file_content'
    ) {
      const target = s('file_path') || s('TargetFile') || s('path')
      // Writing to approved Output / Lead / Memory directories is trusted routine work
      if (
        target.includes('Outputs') ||
        target.includes('data\\leads') ||
        target.includes('data/leads') ||
        target.includes('data\\memory') ||
        target.includes('data/memory') ||
        target.includes('Screenshots')
      ) {
        return {
          verdict: 'allow',
          category: 'file.write',
          reason: 'Trusted output data file saving.',
          actionSummary: `Write output: ${target}`,
        }
      }
    }

    if (tool === 'computer.screenshot' || tool === 'screenshot') {
      return {
        verdict: 'allow',
        category: 'windows.inspect',
        reason: 'Safe screen inspection snapshot.',
        actionSummary: 'Capture desktop screenshot',
      }
    }

    // Fallback category check based on configured defaults
    let category: PermissionCategory = 'terminal.command'
    if (tool.includes('browser')) category = 'browser.navigate'
    else if (tool.includes('computer') || tool.includes('windows')) category = 'windows.control'
    else if (tool.includes('lead')) category = 'lead.database'
    else if (tool.includes('memory')) category = 'memory.operate'

    const configuredVerdict = this.config.defaults[category] || 'allow'
    return {
      verdict: configuredVerdict,
      category,
      reason: `Configured owner permission for ${category}: ${configuredVerdict.toUpperCase()}`,
      actionSummary: `Execute tool ${tool}`,
    }
  }
}

