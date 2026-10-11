import assert from 'node:assert/strict'
import { test } from 'node:test'
import { providerStatuses } from './providers/index.js'
import { runAntigravityTurn } from './providers/antigravity.js'
import type { Agent, Conversation, Team } from '../shared/types.js'

const testAgent: Agent = {
  id: 'lead_collection_specialist',
  name: 'LEAD COLLECTION SPECIALIST',
  role: 'Lead Hunt research and public lead collection',
  color: '#22A06B',
  model: 'default',
  effort: 'low',
  personality: 'You are a test agent. Answer concisely in one sentence.',
  tools: ['WebSearch'],
  permissionMode: 'default',
  shape: 'round',
  mcpServers: [],
  inheritClaudeSettings: false,
  autoApproveTools: false,
  provider: 'antigravity',
  muted: false,
  approvals: 'ask-dangerous',
}

const testTeam: Team = {
  company: 'TSA',
  owner: { id: 'user', name: 'Ajmain', title: 'CEO' },
  workspace: process.cwd(),
  agents: [testAgent],
  mcpServers: {},
  providers: {
    antigravity: {
      kind: 'antigravity',
      label: 'Google Antigravity (Google AI Pro)',
    },
  },
  settings: {
    maxMessagesPerRound: 6,
    maxTurnsPerAgentPerRound: 2,
    maxTurnsPerReply: 40,
    groupMode: 'smart',
    language: 'en',
    notifications: true,
    autoReview: [],
  },
  skills: {},
}

const testConversation: Conversation = {
  id: 'workspace-lead-hunt',
  kind: 'group',
  name: 'LEAD HUNT',
  memberIds: ['user', testAgent.id],
  messages: [
    {
      id: 'm1',
      conversationId: 'workspace-lead-hunt',
      authorId: 'user',
      text: 'Ping from OpenGrokBot. Reply with exactly: Pong from Antigravity',
      createdAt: Date.now(),
      status: 'done',
    },
  ],
  sessions: {},
}

test('antigravity provider status probe detects working agy CLI and Google AI Pro', async () => {
  const statuses = await providerStatuses(testTeam, true)
  const agyStatus = statuses.find((s) => s.id === 'antigravity')
  assert.ok(agyStatus, 'antigravity provider status should exist')
  assert.equal(agyStatus.ok, true, `probe should succeed: ${agyStatus.detail}`)
  assert.match(agyStatus.detail, /Google AI Pro subscription/)
})

test('runAntigravityTurn runs a basic connection test, returns delta, session, and text', async () => {
  const deltas: string[] = []
  let sessionReceived: string | undefined
  let initSource: string | undefined

  const result = await runAntigravityTurn({
    team: testTeam,
    conversation: testConversation,
    agent: testAgent,
    provider: testTeam.providers.antigravity!,
    sessionId: undefined,
    signal: AbortSignal.timeout(60_000),
    handlers: {
      onDelta: (chunk) => deltas.push(chunk),
      onActivity: () => {},
      onSession: (id) => { sessionReceived = id },
      onInit: (src) => { initSource = src },
    },
  })

  assert.equal(result.error, undefined, `turn should not have error: ${result.error}`)
  assert.ok(result.text.length > 0, 'result.text should not be empty')
  assert.ok(deltas.length > 0, 'deltas should be received')
  assert.ok(result.sessionId || sessionReceived, 'sessionId should be populated')
  assert.equal(initSource, 'Google AI Pro')
  assert.ok(result.usage, 'usage should be present')
  assert.ok((result.usage?.inputTokens ?? 0) > 0, 'input tokens should be tracked')
})

const testMarketingAgent: Agent = {
  id: 'marketing',
  name: 'MARKETING',
  role: 'Marketing workspace assistant',
  color: '#e9a6ff',
  model: 'default',
  effort: 'low',
  personality: 'You are a test marketing agent. Answer concisely in one sentence.',
  tools: [],
  permissionMode: 'default',
  shape: 'round',
  mcpServers: [],
  inheritClaudeSettings: false,
  autoApproveTools: false,
  provider: 'antigravity',
  muted: false,
  approvals: 'ask-all',
}

const testMarketingConversation: Conversation = {
  id: 'workspace-marketing',
  kind: 'group',
  name: 'MARKETING',
  memberIds: ['user', 'marketing'],
  messages: [
    {
      id: 'm-mkt-1',
      conversationId: 'workspace-marketing',
      authorId: 'user',
      text: 'Marketing connection check. Reply with: Marketing online via Antigravity',
      createdAt: Date.now(),
      status: 'done',
    },
  ],
  sessions: {},
}

test('runAntigravityTurn runs turn for marketing agent successfully', async () => {
  const deltas: string[] = []
  let sessionReceived: string | undefined

  const result = await runAntigravityTurn({
    team: {
      ...testTeam,
      agents: [testMarketingAgent],
    },
    conversation: testMarketingConversation,
    agent: testMarketingAgent,
    provider: testTeam.providers.antigravity!,
    sessionId: undefined,
    signal: AbortSignal.timeout(60_000),
    handlers: {
      onDelta: (chunk) => deltas.push(chunk),
      onActivity: () => {},
      onSession: (id) => { sessionReceived = id },
      onInit: () => {},
    },
  })

  assert.equal(result.error, undefined, `marketing turn should not have error: ${result.error}`)
  assert.ok(result.text.length > 0, 'marketing result.text should not be empty')
  assert.ok(deltas.length > 0, 'marketing deltas should be received')
  assert.ok(result.sessionId || sessionReceived, 'marketing sessionId should be populated')
})

