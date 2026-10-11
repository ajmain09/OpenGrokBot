import { buildSystemPrompt, buildTurnPrompt, stripSkip } from '../prompt.js'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { runCli } from './cli.js'
import { emptyUsage, type RunTurnParams, type TurnResult } from './types.js'

const EFFORT: Record<string, string> = { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'xhigh' }
const WINDOWS_MCP_TOOLS = ['app', 'window_management', 'ui_snapshot', 'ui_find', 'ui_read', 'ui_wait', 'screenshot_control']

function isolatedMcpConfig(teamWorkspace: string, agentId: string): string[] {
  const profiles: Record<string, string> = {
    lead_collection_specialist: 'lead-hunt',
    marketing: 'marketing',
  }
  const profileName = profiles[agentId]
  if (!profileName && agentId !== 'windows_operator') return []

  // Do not let a general-purpose computer-use plugin win over the intended native
  // Windows MCP server. The whitelist deliberately excludes process termination,
  // clipboard access, raw mouse/keyboard input, and batch actions.
  const localAppData = process.env.LOCALAPPDATA ?? 'C:\\Users\\Windows\\AppData\\Local'
  const windowsMcp = `${localAppData}\\OpenGrokBot\\tools\\windows-mcp\\Sbroenne.WindowsMcp.exe`
  const out = [
    '--ignore-user-config',
    '-c', `mcp_servers.windows.command='${windowsMcp}'`,
    '-c', `mcp_servers.windows.enabled_tools=[${WINDOWS_MCP_TOOLS.map((tool) => `'${tool}'`).join(',')}]`,
    '-c', "mcp_servers.windows.default_tools_approval_mode='approve'",
  ]
  if (!profileName) return out

  // Each workspace owns a persistent Chrome user-data directory. It survives
  // OpenGrokBot restarts but is separate from the owner's everyday profile.
  const profileDir = path.join(teamWorkspace, 'data', 'browser-profiles', profileName)
  mkdirSync(profileDir, { recursive: true })
  const playwrightTools = agentId === 'marketing'
    ? ['browser_navigate', 'browser_snapshot', 'browser_tabs', 'browser_wait_for']
    : []
  return [
    ...out,
    '-c', "mcp_servers.playwright.command='npx'",
    '-c', `mcp_servers.playwright.args=['-y','@playwright/mcp@latest','--browser','chrome','--user-data-dir=${profileDir}','--no-webmcp','--block-service-workers','--timeout-action','5000','--timeout-navigation','15000','--idle-timeout','30000']`,
    ...(playwrightTools.length > 0 ? ['-c', `mcp_servers.playwright.enabled_tools=[${playwrightTools.map((tool) => `'${tool}'`).join(',')}]`] : []),
    '-c', "mcp_servers.playwright.default_tools_approval_mode='approve'",
  ]
}

interface CodexEvent {
  type: string
  thread_id?: string
  item?: { type: string; text?: string; command?: string; changes?: unknown[]; query?: string; status?: string; server?: string; tool?: string; error?: { message?: string } | null }
  usage?: { input_tokens?: number; cached_input_tokens?: number; cache_write_input_tokens?: number; output_tokens?: number }
  error?: { message?: string }
  message?: string
}

function sandboxFor(tools: string[], autoApprove: boolean): string {
  if (autoApprove) return 'danger-full-access'
  return tools.some((t) => ['Edit', 'Write', 'Bash'].includes(t)) ? 'workspace-write' : 'read-only'
}

/** OpenAI Codex CLI in headless mode. Uses `codex login` (ChatGPT subscription) unless the provider has an API key. */
export async function runCodexTurn(params: RunTurnParams): Promise<TurnResult> {
  const { team, conversation, agent, provider, sessionId, signal, handlers, note, notes } = params
  const started = Date.now()
  const cwd = agent.cwd ?? team.workspace
  const common = ['--json', '--skip-git-repo-check', '-C', cwd, ...isolatedMcpConfig(team.workspace, agent.id), ...(agent.model && agent.model !== 'default' ? ['-m', agent.model] : []), '-s', sandboxFor(agent.tools, agent.autoApproveTools || agent.permissionMode === 'bypassPermissions'), '-c', `model_reasoning_effort='${EFFORT[agent.effort] ?? 'medium'}'`]
  if (agent.autoApproveTools || agent.permissionMode === 'bypassPermissions') common.push('--dangerously-bypass-approvals-and-sandbox')
  const args = sessionId ? ['exec', ...common, 'resume', sessionId, '-'] : ['exec', ...common, '-']

  // Codex has no system-prompt flag: the persona rides in the first prompt of the thread.
  const transcript = buildTurnPrompt(team, conversation, agent, sessionId !== undefined, note)
  const stdin = sessionId ? transcript : `<system>\n${buildSystemPrompt(team, conversation, agent, '', notes ?? '')}\n</system>\n\n${transcript}`

  const env: NodeJS.ProcessEnv = { ...process.env }
  if (provider.apiKey) env.OPENAI_API_KEY = provider.apiKey
  else delete env.OPENAI_API_KEY

  let text = ''
  let session: string | undefined
  let error: string | undefined
  const usage = emptyUsage(agent.model)

  const run = await runCli('codex', args, {
    cwd,
    env,
    stdin,
    signal,
    // Codex is an .exe on this PC. Avoid cmd.exe so the TOML array values used
    // for role-specific MCP tool whitelists reach Codex unchanged.
    shell: false,
    onLine: (line) => {
      if (!line.startsWith('{')) return
      let ev: CodexEvent
      try {
        ev = JSON.parse(line) as CodexEvent
      } catch {
        return
      }
      if (ev.type === 'thread.started' && ev.thread_id) {
        session = ev.thread_id
        handlers.onSession(session)
      } else if (ev.type === 'item.completed' && ev.item) {
        const item = ev.item
        if (item.type === 'agent_message' && item.text) {
          const chunk = (text.length > 0 ? '\n\n' : '') + item.text
          text += chunk
          handlers.onDelta(chunk)
        } else if (item.type === 'command_execution' && item.command) {
          handlers.onActivity(`Bash ${item.command}`.slice(0, 160))
        } else if (item.type === 'file_change') {
          handlers.onActivity(`Edited ${Array.isArray(item.changes) ? item.changes.length : ''} file(s)`.trim())
        } else if (item.type === 'web_search' && item.query) {
          handlers.onActivity(`Searching the web: ${item.query}`)
        } else if (item.type === 'mcp_tool_call' && item.server && item.tool) {
          const status = item.status === 'completed' ? ' completed' : item.status === 'failed' ? ' failed' : ''
          const label = item.server === 'playwright' ? 'Browser' : `MCP ${item.server}`
          handlers.onActivity(`${label}: ${item.tool}${status}`)
        }
      } else if (ev.type === 'item.started' && ev.item?.type === 'command_execution' && ev.item.command) {
        handlers.onActivity(`Bash ${ev.item.command}`.slice(0, 160))
      } else if (ev.type === 'item.started' && ev.item?.type === 'mcp_tool_call' && ev.item.server && ev.item.tool) {
        const label = ev.item.server === 'playwright' ? 'Browser' : `MCP ${ev.item.server}`
        handlers.onActivity(`${label}: ${ev.item.tool}`)
      } else if (ev.type === 'turn.completed' && ev.usage) {
        usage.inputTokens = ev.usage.input_tokens ?? 0
        usage.cacheReadTokens = ev.usage.cached_input_tokens ?? 0
        usage.cacheCreationTokens = ev.usage.cache_write_input_tokens ?? 0
        usage.outputTokens = ev.usage.output_tokens ?? 0
      } else if (ev.type === 'turn.failed' || ev.type === 'error') {
        error = ev.error?.message ?? ev.message ?? 'Codex reported an error.'
      }
    },
  })

  usage.durationMs = Date.now() - started
  if (run.aborted) error = 'Stopped.'
  else if (run.exitCode !== 0 && !error) {
    const tail = run.stderr.trim().split('\n').slice(-3).join(' ').trim()
    error = tail || `codex exited with code ${run.exitCode}`
    if (/not logged in|login|auth/i.test(tail) && !/logged in using/i.test(tail)) error = `Codex is not logged in. Run \`codex login\` in a terminal. (${tail})`
  }

  const out: TurnResult = { text: error ? text.trim() : stripSkip(text), usage }
  if (error) out.error = error
  if (session) out.sessionId = session
  return out
}
