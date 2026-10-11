import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { LeadStore } from './leads.js'

function sample(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    businessName: 'Example ISP',
    industry: 'ISP',
    districtLocation: 'Khulna',
    publicBusinessPhone: '+880 1234 567890',
    officialWebsite: 'https://example.test/',
    facebookPageUrl: '',
    sourceUrl: 'https://example.test/contact',
    marketingOpportunity: 'Website review',
    verificationStatus: 'verified',
    collectionDate: '2026-10-11',
    outreachStatus: 'not-contacted',
    ...overrides,
  }
}

test('lead store merges duplicate businesses and exports Excel-safe CSV', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'opengrokbot-leads-'))
  const store = new LeadStore(dir)
  assert.equal(store.upsert(sample()).created, true)
  assert.equal(store.upsert(sample({ publicBusinessPhone: '+880 9999 000000', marketingOpportunity: '=unsafe formula' })).created, false)
  assert.equal(store.summary().total, 1)
  const file = store.exportCsv()
  const csv = readFileSync(file, 'utf8')
  assert.match(csv, /Business Name/)
  assert.match(csv, /'=unsafe formula/)
})

test('lead import honors a requested maximum and supports removing a lead', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'opengrokbot-leads-'))
  const store = new LeadStore(dir)
  const result = store.import([sample(), sample({ businessName: 'Second ISP', officialWebsite: 'https://second.test/', sourceUrl: 'https://second.test/contact' })], 1)
  assert.deepEqual(result, { created: 1, updated: 0, total: 1, processed: 1, skipped: 1 })
  const [lead] = store.list()
  assert.ok(lead)
  assert.equal(store.remove(lead.id), true)
  assert.equal(store.summary().total, 0)
})
