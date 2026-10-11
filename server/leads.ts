import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Lead, LeadOutreachStatus, LeadSummary, LeadVerificationStatus } from '../shared/types.js'

const VERIFICATION: LeadVerificationStatus[] = ['verified', 'partially-verified', 'unverified']
const OUTREACH: LeadOutreachStatus[] = ['not-contacted', 'review-needed', 'contacted', 'qualified', 'not-a-fit']
const CSV_COLUMNS: { key: keyof Lead; label: string }[] = [
  { key: 'businessName', label: 'Business Name' },
  { key: 'industry', label: 'Industry' },
  { key: 'districtLocation', label: 'District / Location' },
  { key: 'publicBusinessPhone', label: 'Public Business Phone' },
  { key: 'officialWebsite', label: 'Official Website' },
  { key: 'facebookPageUrl', label: 'Facebook Page URL' },
  { key: 'sourceUrl', label: 'Source URL' },
  { key: 'marketingOpportunity', label: 'Marketing Opportunity' },
  { key: 'verificationStatus', label: 'Verification Status' },
  { key: 'collectionDate', label: 'Collection Date' },
  { key: 'outreachStatus', label: 'Outreach Status' },
]

export class LeadStoreError extends Error {}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown, field: string, required = false): string {
  if (value === undefined || value === null) {
    if (required) throw new LeadStoreError(`${field} is required`)
    return ''
  }
  if (typeof value !== 'string') throw new LeadStoreError(`${field} must be text`)
  const clean = value.trim().replace(/\s+/g, ' ')
  if (required && !clean) throw new LeadStoreError(`${field} is required`)
  return clean
}

function url(value: unknown, field: string, required = false): string {
  const clean = text(value, field, required)
  if (!clean) return ''
  try {
    const parsed = new URL(clean)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('protocol')
    return parsed.toString()
  } catch {
    throw new LeadStoreError(`${field} must be a public http(s) URL`)
  }
}

function date(value: unknown): string {
  const clean = text(value, 'collectionDate')
  if (!clean) return new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || Number.isNaN(Date.parse(`${clean}T00:00:00Z`))) throw new LeadStoreError('collectionDate must be YYYY-MM-DD')
  return clean
}

function choice<T extends string>(value: unknown, field: string, choices: readonly T[], fallback: T): T {
  const clean = text(value, field)
  if (!clean) return fallback
  if (!choices.includes(clean as T)) throw new LeadStoreError(`${field} must be one of ${choices.join(', ')}`)
  return clean as T
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function websiteIdentity(value: string): string {
  if (!value) return ''
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function verificationRank(value: LeadVerificationStatus): number {
  return VERIFICATION.indexOf(value)
}

export type LeadInput = Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>

export class LeadStore {
  readonly dir: string
  readonly file: string

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, 'leads')
    this.file = path.join(this.dir, 'leads.json')
    mkdirSync(this.dir, { recursive: true })
  }

  private normalizeInput(value: unknown): LeadInput {
    const raw = record(value)
    return {
      businessName: text(raw.businessName, 'businessName', true),
      industry: text(raw.industry, 'industry'),
      districtLocation: text(raw.districtLocation, 'districtLocation'),
      publicBusinessPhone: text(raw.publicBusinessPhone, 'publicBusinessPhone'),
      officialWebsite: url(raw.officialWebsite, 'officialWebsite'),
      facebookPageUrl: url(raw.facebookPageUrl, 'facebookPageUrl'),
      sourceUrl: url(raw.sourceUrl, 'sourceUrl', true),
      marketingOpportunity: text(raw.marketingOpportunity, 'marketingOpportunity'),
      verificationStatus: choice(raw.verificationStatus, 'verificationStatus', VERIFICATION, 'unverified'),
      collectionDate: date(raw.collectionDate),
      outreachStatus: choice(raw.outreachStatus, 'outreachStatus', OUTREACH, 'not-contacted'),
    }
  }

  private read(): Lead[] {
    if (!existsSync(this.file)) return []
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.file, 'utf8'))
      if (!Array.isArray(parsed)) return []
      return parsed.filter((item): item is Lead => {
        const raw = record(item)
        return typeof raw.id === 'string' && typeof raw.businessName === 'string' && typeof raw.sourceUrl === 'string'
      })
    } catch {
      throw new LeadStoreError('The local leads database is unreadable. Restore data/leads/leads.json from a backup before importing more leads.')
    }
  }

  private write(leads: Lead[]): void {
    mkdirSync(this.dir, { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, `${JSON.stringify(leads, null, 2)}\n`, 'utf8')
    renameSync(tmp, this.file)
  }

  list(): Lead[] {
    return this.read().sort((a, b) => b.collectionDate.localeCompare(a.collectionDate) || b.updatedAt - a.updatedAt)
  }

  summary(): LeadSummary {
    const leads = this.read()
    return {
      total: leads.length,
      verified: leads.filter((lead) => lead.verificationStatus === 'verified').length,
      partiallyVerified: leads.filter((lead) => lead.verificationStatus === 'partially-verified').length,
      unverified: leads.filter((lead) => lead.verificationStatus === 'unverified').length,
    }
  }

  private sameBusiness(a: Lead, b: LeadInput): boolean {
    const nameMatch = normalize(a.businessName) === normalize(b.businessName)
    const locationMatch = normalize(a.districtLocation) === normalize(b.districtLocation)
    if (nameMatch && (locationMatch || !a.districtLocation || !b.districtLocation)) return true
    const aSite = websiteIdentity(a.officialWebsite)
    const bSite = websiteIdentity(b.officialWebsite)
    return Boolean(aSite && bSite && aSite === bSite)
  }

  upsert(value: unknown): { lead: Lead; created: boolean } {
    const incoming = this.normalizeInput(value)
    const leads = this.read()
    const now = Date.now()
    const index = leads.findIndex((lead) => this.sameBusiness(lead, incoming))
    if (index === -1) {
      const lead: Lead = { id: randomUUID(), ...incoming, createdAt: now, updatedAt: now }
      leads.push(lead)
      this.write(leads)
      return { lead, created: true }
    }

    const current = leads[index]
    if (!current) throw new LeadStoreError('lead update failed')
    const next: Lead = {
      ...current,
      businessName: incoming.businessName || current.businessName,
      industry: incoming.industry || current.industry,
      districtLocation: incoming.districtLocation || current.districtLocation,
      publicBusinessPhone: incoming.publicBusinessPhone || current.publicBusinessPhone,
      officialWebsite: incoming.officialWebsite || current.officialWebsite,
      facebookPageUrl: incoming.facebookPageUrl || current.facebookPageUrl,
      sourceUrl: incoming.sourceUrl || current.sourceUrl,
      marketingOpportunity: incoming.marketingOpportunity || current.marketingOpportunity,
      verificationStatus: verificationRank(incoming.verificationStatus) < verificationRank(current.verificationStatus) ? incoming.verificationStatus : current.verificationStatus,
      collectionDate: incoming.collectionDate || current.collectionDate,
      outreachStatus: current.outreachStatus === 'not-contacted' ? incoming.outreachStatus : current.outreachStatus,
      updatedAt: now,
    }
    leads[index] = next
    this.write(leads)
    return { lead: next, created: false }
  }

  import(value: unknown, limit?: number): { created: number; updated: number; total: number; processed: number; skipped: number } {
    const raw = Array.isArray(value) ? value : record(value).leads
    if (!Array.isArray(raw) || raw.length === 0) throw new LeadStoreError('Import must contain a non-empty leads array')
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new LeadStoreError('limit must be a positive whole number')
    const selected = limit === undefined ? raw : raw.slice(0, limit)
    let created = 0
    let updated = 0
    for (const item of selected) {
      const result = this.upsert(item)
      if (result.created) created++
      else updated++
    }
    return { created, updated, total: this.summary().total, processed: selected.length, skipped: raw.length - selected.length }
  }

  remove(id: string): boolean {
    const clean = id.trim()
    if (!clean) throw new LeadStoreError('lead id is required')
    const leads = this.read()
    const index = leads.findIndex((lead) => lead.id === clean)
    if (index === -1) return false
    leads.splice(index, 1)
    this.write(leads)
    return true
  }

  csv(): string {
    const cell = (value: unknown): string => {
      let textValue = String(value ?? '').replace(/\r?\n/g, ' ')
      // Prevent spreadsheet formula execution when a CSV is opened in Excel.
      if (/^[=+\-@]/.test(textValue)) textValue = `'${textValue}`
      return `"${textValue.replace(/"/g, '""')}"`
    }
    const lines = [CSV_COLUMNS.map((column) => cell(column.label)).join(',')]
    for (const lead of this.list()) lines.push(CSV_COLUMNS.map((column) => cell(lead[column.key])).join(','))
    return `\uFEFF${lines.join('\r\n')}\r\n`
  }

  get(id: string): Lead | undefined {
    return this.read().find((l) => l.id === id)
  }

  update(id: string, patch: Partial<Omit<Lead, 'id' | 'createdAt'>>): Lead | undefined {
    const leads = this.read()
    const index = leads.findIndex((l) => l.id === id)
    if (index === -1) return undefined
    const current = leads[index]
    if (!current) return undefined

    const updated: Lead = {
      id: current.id,
      businessName: patch.businessName ?? current.businessName,
      industry: patch.industry ?? current.industry,
      districtLocation: patch.districtLocation ?? current.districtLocation,
      publicBusinessPhone: patch.publicBusinessPhone ?? current.publicBusinessPhone,
      officialWebsite: patch.officialWebsite ?? current.officialWebsite,
      facebookPageUrl: patch.facebookPageUrl ?? current.facebookPageUrl,
      sourceUrl: patch.sourceUrl ?? current.sourceUrl,
      marketingOpportunity: patch.marketingOpportunity ?? current.marketingOpportunity,
      verificationStatus: patch.verificationStatus ?? current.verificationStatus,
      collectionDate: patch.collectionDate ?? current.collectionDate,
      outreachStatus: patch.outreachStatus ?? current.outreachStatus,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
    }
    leads[index] = updated
    this.write(leads)
    return updated
  }

  exportCsv(destination?: string): string {
    const file = destination ? path.resolve(destination) : path.join(this.dir, 'leads.csv')
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, this.csv(), 'utf8')
    return file
  }
}

