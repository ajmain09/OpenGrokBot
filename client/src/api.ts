import type { AccountStatus, Agent, AppState, Attachment, Brand, Conversation, Lead, LeadSummary, McpServerDef, Message, ProviderDef, ProviderStatus, Routine, RoutineRun, Skill, TeamSettings, Workflow } from '../../shared/types'

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`)
  return body
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export function fetchState(): Promise<AppState> {
  return call<AppState>('/api/state')
}

export async function sendMessage(conversationId: string, text: string): Promise<Message> {
  const data = await call<{ message: Message }>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, json('POST', { text }))
  return data.message
}

export function stopRound(conversationId: string): Promise<unknown> {
  return call(`/api/conversations/${encodeURIComponent(conversationId)}/stop`, { method: 'POST' })
}

export function clearConversation(conversationId: string): Promise<unknown> {
  return call(`/api/conversations/${encodeURIComponent(conversationId)}/clear`, { method: 'POST' })
}

export function createConversation(name: string, memberIds: string[]): Promise<{ conversation: Conversation }> {
  return call('/api/conversations', json('POST', { name, memberIds }))
}

export function updateConversation(id: string, patch: { name?: string; memberIds?: string[]; pinned?: boolean; hidden?: boolean }): Promise<{ conversation: Conversation }> {
  return call(`/api/conversations/${encodeURIComponent(id)}`, json('PUT', patch))
}

export function deleteConversation(id: string): Promise<unknown> {
  return call(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function exportUrl(id: string): string {
  return `/api/conversations/${encodeURIComponent(id)}/export.md`
}

export async function listLeads(brandId?: string): Promise<{ leads: Lead[]; summary: LeadSummary }> {
  return call(`/api/leads${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`)
}

export function leadExportUrl(brandId?: string): string {
  return `/api/leads/export.csv${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`
}

export type AgentPatch = Partial<Omit<Agent, 'id'>>

export function updateAgent(id: string, patch: AgentPatch): Promise<{ agent: Agent }> {
  return call(`/api/team/agents/${encodeURIComponent(id)}`, json('PUT', patch))
}

export function createAgent(agent: Agent): Promise<{ agent: Agent }> {
  return call('/api/team/agents', json('POST', agent))
}

export function duplicateAgent(id: string): Promise<{ agent: Agent }> {
  return call(`/api/team/agents/${encodeURIComponent(id)}/duplicate`, { method: 'POST' })
}

export function deleteAgent(id: string): Promise<unknown> {
  return call(`/api/team/agents/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function putMcpServer(name: string, def: McpServerDef): Promise<unknown> {
  return call(`/api/team/mcp/${encodeURIComponent(name)}`, json('PUT', def))
}

export function deleteMcpServer(name: string): Promise<unknown> {
  return call(`/api/team/mcp/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export function putProvider(id: string, def: Partial<ProviderDef>): Promise<unknown> {
  return call(`/api/team/providers/${encodeURIComponent(id)}`, json('PUT', def))
}

export function deleteProvider(id: string): Promise<unknown> {
  return call(`/api/team/providers/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function providerStatuses(force = false): Promise<ProviderStatus[]> {
  const data = await call<{ statuses: ProviderStatus[] }>(`/api/providers/status${force ? '?force=1' : ''}`)
  return data.statuses
}

export interface SettingsPatch {
  company?: string
  workspace?: string
  ownerName?: string
  ownerTitle?: string
  settings?: Partial<TeamSettings>
}

export function putSettings(patch: SettingsPatch): Promise<unknown> {
  return call('/api/team/settings', json('PUT', patch))
}

export function refreshAccount(): Promise<{ account: AccountStatus }> {
  return call('/api/account/refresh', { method: 'POST' })
}

export function openFile(path: string): Promise<unknown> {
  return call('/api/open', json('POST', { path }))
}

export async function sendMessageFull(conversationId: string, body: { text: string; attachments?: Attachment[]; replyTo?: Message['replyTo'] }): Promise<Message> {
  const data = await call<{ message: Message }>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, json('POST', body))
  return data.message
}

export async function uploadFile(conversationId: string, file: File): Promise<Attachment> {
  const res = await fetch(`/api/uploads/${encodeURIComponent(conversationId)}/${encodeURIComponent(file.name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string; attachment?: Attachment }
  if (!res.ok || !body.attachment) throw new Error(body.error ?? `upload ${res.status}`)
  return body.attachment
}

export function fileUrl(path: string): string {
  return `/api/file?path=${encodeURIComponent(path)}`
}

export function resolveApproval(id: string, allow: boolean, always = false): Promise<unknown> {
  return call(`/api/approvals/${encodeURIComponent(id)}`, json('POST', { allow, always }))
}

export async function getMemory(agentId: string): Promise<string> {
  const data = await call<{ notes: string }>(`/api/team/agents/${encodeURIComponent(agentId)}/memory`)
  return data.notes
}

export function putMemory(agentId: string, notes: string): Promise<unknown> {
  return call(`/api/team/agents/${encodeURIComponent(agentId)}/memory`, json('PUT', { notes }))
}

export function putSkill(id: string, skill: Skill): Promise<unknown> {
  return call(`/api/team/skills/${encodeURIComponent(id)}`, json('PUT', skill))
}

export function deleteSkill(id: string): Promise<unknown> {
  return call(`/api/team/skills/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function putRoutine(id: string, body: Pick<Routine, 'name' | 'agentId' | 'conversationId' | 'cron' | 'instruction' | 'enabled'>): Promise<{ routine: Routine }> {
  return call(`/api/routines/${encodeURIComponent(id)}`, json('PUT', body))
}

export function deleteRoutine(id: string): Promise<unknown> {
  return call(`/api/routines/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function runRoutine(id: string): Promise<{ run: RoutineRun }> {
  return call(`/api/routines/${encodeURIComponent(id)}/run`, { method: 'POST' })
}

export async function cronPresets(): Promise<{ label: string; cron: string }[]> {
  const data = await call<{ presets: { label: string; cron: string }[] }>('/api/routines/presets')
  return data.presets
}

export function exportAgentUrl(id: string): string {
  return `/api/team/agents/${encodeURIComponent(id)}/export.json`
}

export function importAgent(agent: unknown): Promise<{ agent: Agent }> {
  return call('/api/team/agents/import', json('POST', { agent }))
}

// ---- Management Systems APIs ----

export function fetchDashboard(brandId?: string): Promise<{
  activeProvider: string
  activeBrand?: string
  providerDetails: {
    antigravity?: ProviderStatus
    codex?: ProviderStatus
  }
  tasks: {
    running: number
    queued: number
    completed: number
    failed: number
    recent: any[]
  }
  leads: LeadSummary
  approvals: {
    pendingCount: number
    pending: any[]
    recentHistory: any[]
  }
  outputs: {
    baseDir: string
    recent: any[]
  }
  browsers: any[]
}> {
  return call(`/api/dashboard${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`)
}

export function listTasks(brandId?: string): Promise<any[]> {
  return call(`/api/tasks${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`)
}

export function createTask(task: { title: string; workspace: string; prompt: string; brandId?: string }): Promise<any> {
  return call('/api/tasks', json('POST', task))
}

export function cancelTask(id: string): Promise<{ ok: boolean }> {
  return call(`/api/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

export function retryTask(id: string): Promise<{ ok: boolean }> {
  return call(`/api/tasks/${encodeURIComponent(id)}/retry`, { method: 'POST' })
}

export function deleteTask(id: string): Promise<{ ok: boolean }> {
  return call(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function clearFinishedTasks(): Promise<{ ok: boolean }> {
  return call('/api/tasks', { method: 'DELETE' })
}

export function listMemories(scope?: string, brandId?: string): Promise<any[]> {
  const params = new URLSearchParams()
  if (scope) params.set('scope', scope)
  if (brandId) params.set('brandId', brandId)
  const qs = params.toString()
  return call(`/api/memory${qs ? `?${qs}` : ''}`)
}

export function addMemory(item: { scope: string; category: string; title: string; content: string; brandId?: string }): Promise<any> {
  return call('/api/memory', json('POST', item))
}

export function updateMemoryItem(id: string, patch: any): Promise<any> {
  return call(`/api/memory/${encodeURIComponent(id)}`, json('PUT', patch))
}

export function deleteMemoryItem(id: string): Promise<{ ok: boolean }> {
  return call(`/api/memory/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function searchMemories(q: string): Promise<any[]> {
  return call(`/api/memory/search?q=${encodeURIComponent(q)}`)
}

export function clearMemories(scope?: string): Promise<{ ok: boolean }> {
  return call(`/api/memory${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`, { method: 'DELETE' })
}

export function listOutputs(brandId?: string): Promise<{ dir: string; files: any[] }> {
  return call(`/api/outputs${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`)
}

export function openOutputPath(path: string): Promise<{ ok: boolean }> {
  return call('/api/outputs/open', json('POST', { path }))
}

export function openOutputFolder(category?: string, brandId?: string): Promise<{ ok: boolean }> {
  return call('/api/outputs/open-folder', json('POST', { category, brandId }))
}

export function fetchOutputPreview(path: string): Promise<{ content: string; binary: boolean }> {
  return call(`/api/outputs/preview?path=${encodeURIComponent(path)}`)
}

export function updateOutputsDir(dir: string): Promise<{ ok: boolean; dir: string }> {
  return call('/api/outputs/config', json('POST', { dir }))
}

export function listBrowsers(): Promise<any[]> {
  return call('/api/browsers')
}

export function openBrowserProfile(id: 'lead-hunt' | 'marketing'): Promise<{ ok: boolean; message: string }> {
  return call(`/api/browsers/${encodeURIComponent(id)}/open`, { method: 'POST' })
}

export function restartBrowserProfile(id: 'lead-hunt' | 'marketing'): Promise<{ ok: boolean; message: string }> {
  return call(`/api/browsers/${encodeURIComponent(id)}/restart`, { method: 'POST' })
}

export function fetchApprovalHistory(): Promise<any[]> {
  return call('/api/approvals/history')
}

export function clearApprovalHistory(): Promise<{ ok: boolean }> {
  return call('/api/approvals/history', { method: 'DELETE' })
}

export function updateLead(id: string, patch: Partial<Lead>): Promise<{ lead: Lead }> {
  return call(`/api/leads/${encodeURIComponent(id)}`, json('PUT', patch))
}

export function deleteLead(id: string): Promise<unknown> {
  return call(`/api/leads/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function importLeads(data: unknown): Promise<{ created: number; updated: number; total: number; processed: number }> {
  return call('/api/leads/import', json('POST', data))
}

export function sendLeadsToMarketing(leadIds: string[]): Promise<{ ok: boolean; count: number }> {
  return call('/api/leads/to-marketing', json('POST', { leadIds }))
}

// ---- Multi-Brand API ----
export function fetchBrands(): Promise<Brand[]> {
  return call('/api/brands')
}

export function createBrand(brand: { name: string; tagline?: string; description?: string; color?: string }): Promise<{ brand: Brand }> {
  return call('/api/brands', json('POST', brand))
}

export function updateBrand(id: string, patch: Partial<Brand>): Promise<{ brand: Brand }> {
  return call(`/api/brands/${encodeURIComponent(id)}`, json('PUT', patch))
}

export function deleteBrand(id: string): Promise<{ ok: boolean }> {
  return call(`/api/brands/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ---- AI Bot Builder & Customization API ----
export function generateBotConfig(prompt: string, brandId?: string): Promise<{ agent: Agent }> {
  return call('/api/bot-builder/generate', json('POST', { prompt, brandId }))
}

export function restoreBotVersion(id: string, version: number): Promise<{ agent: Agent }> {
  return call(`/api/team/agents/${encodeURIComponent(id)}/restore-version/${version}`, { method: 'POST' })
}

// ---- Workflows API ----
export function fetchWorkflows(brandId?: string): Promise<Workflow[]> {
  return call(`/api/workflows${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`)
}

export function createWorkflow(input: unknown): Promise<{ workflow: Workflow }> {
  return call('/api/workflows', json('POST', input))
}

export function updateWorkflow(id: string, patch: unknown): Promise<{ workflow: Workflow }> {
  return call(`/api/workflows/${encodeURIComponent(id)}`, json('PUT', patch))
}

export function deleteWorkflow(id: string): Promise<{ ok: boolean }> {
  return call(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function runWorkflow(id: string): Promise<{ ok: boolean; queuedSteps: number }> {
  return call(`/api/workflows/${encodeURIComponent(id)}/run`, { method: 'POST' })
}

// ---- Computer & Tool Control API ----
export function fetchComputerStatus(): Promise<{
  platform: string
  arch: string
  nodeVersion: string
  windowsAutomationSupported: boolean
  powershellAvailable: boolean
  timestamp: number
}> {
  return call('/api/computer/status')
}

export function captureScreenshot(brandId?: string): Promise<{ ok: boolean; path: string; filename: string }> {
  return call('/api/computer/screenshot', json('POST', { brandId }))
}

export function testTool(tool: string): Promise<{ ok: boolean; tool: string; message: string }> {
  return call('/api/tools/test', json('POST', { tool }))
}

