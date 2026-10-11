import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { buildSystemPrompt, buildTurnPrompt, stripSkip } from '../prompt.js'
import { runCli } from './cli.js'
import { emptyUsage, type RunTurnParams, type TurnResult } from './types.js'

interface AgyStreamEvent {
  event: string
  conversation_id?: string
  init?: {
    cwd?: string
    tools?: string[]
  }
  step_update?: {
    conversation_id?: string
    step_index?: number
    state?: string
    step_type?: string
    tool_name?: string
    duration_seconds?: number
    text_delta?: string
    tool_info?: {
      name?: string
      parameters?: Record<string, unknown>
      output?: unknown
    }
    usage?: {
      input_tokens?: number
      output_tokens?: number
      thinking_tokens?: number
      cache_read_tokens?: number
      total_tokens?: number
    }
  }
  result?: {
    conversation_id?: string
    status?: string
    response?: string
    duration_seconds?: number
    num_turns?: number
    error?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      thinking_tokens?: number
      cache_read_tokens?: number
      total_tokens?: number
    }
  }
}

function resolveAgyPath(): string {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const candidate = path.join(process.env.LOCALAPPDATA, 'agy', 'bin', 'agy.exe')
    if (existsSync(candidate)) return candidate
  }
  return 'agy'
}

function summarizeTool(toolName: string, params: Record<string, unknown> = {}): string {
  switch (toolName) {
    case 'run_command':
      return `Bash ${(params.CommandLine as string) ?? ''}`
    case 'open_browser_url':
      return `Browser open: ${(params.Url as string) ?? (params.url as string) ?? ''}`
    case 'read_browser_page':
      return `Browser read: ${(params.Url as string) ?? (params.url as string) ?? 'page'}`
    case 'browser_click_element':
      return `Browser click: ${(params.selector as string) ?? (params.text as string) ?? 'element'}`
    case 'browser_input':
      return `Browser type: ${(params.text as string) ?? ''}`
    case 'capture_browser_screenshot':
      return 'Browser screenshot'
    case 'call_mcp_tool':
      return `MCP ${(params.server as string) ?? (params.name as string) ?? ''}: ${(params.tool as string) ?? ''}`
    case 'search_web':
      return `Searching the web: ${(params.query as string) ?? ''}`
    case 'read_url_content':
      return `Fetching ${(params.Url as string) ?? ''}`
    case 'view_file':
      return `Read ${(params.AbsolutePath as string) ?? ''}`
    case 'write_to_file':
      return `Write ${(params.TargetFile as string) ?? ''}`
    case 'replace_file_content':
      return `Edit ${(params.TargetFile as string) ?? ''}`
    default:
      return `Tool: ${toolName}`
  }
}

/**
 * Native Google Antigravity CLI (agy) provider in headless streaming mode.
 * Reuses the existing Google AI Pro account without Gemini API keys or Codex.
 */
export async function runAntigravityTurn(params: RunTurnParams): Promise<TurnResult> {
  const { team, conversation, agent, sessionId, signal, handlers, note, notes } = params
  const started = Date.now()
  const cwd = agent.cwd ?? team.workspace

  // Ensure persistent Chrome profile directories exist if applicable
  const profiles: Record<string, string> = {
    lead_collection_specialist: 'lead-hunt',
    marketing: 'marketing',
  }
  const profileName = profiles[agent.id]
  if (profileName) {
    const profileDir = path.join(team.workspace, 'data', 'browser-profiles', profileName)
    mkdirSync(profileDir, { recursive: true })
  }

  const agyExe = resolveAgyPath()
  const args = [
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
  ]

  if (agent.permissionMode === 'plan') {
    args.push('--mode', 'plan')
  }

  if (agent.model && agent.model !== 'default') {
    args.push('--model', agent.model)
  }

  if (agent.effort) {
    args.push('--effort', agent.effort)
  }

  if (sessionId) {
    args.push('--conversation', sessionId)
  }

  const transcript = buildTurnPrompt(team, conversation, agent, sessionId !== undefined, note)
  const stdin = sessionId
    ? transcript
    : `<system>\n${buildSystemPrompt(team, conversation, agent, '', notes ?? '')}\n</system>\n\n${transcript}`

  // Clean environment so agy relies strictly on the Google AI Pro subscription login
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' }
  delete env.GEMINI_API_KEY
  delete env.GOOGLE_API_KEY
  delete env.OPENAI_API_KEY
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN

  let text = ''
  let resultText = ''
  let session: string | undefined = sessionId
  let error: string | undefined
  const usage = emptyUsage(agent.model || 'default')

  const run = await runCli(agyExe, args, {
    cwd,
    env,
    stdin,
    signal,
    shell: false,
    onLine: (line) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('{')) return

      let ev: AgyStreamEvent
      try {
        ev = JSON.parse(trimmed) as AgyStreamEvent
      } catch {
        return
      }

      if (ev.event === 'init') {
        if (ev.conversation_id) {
          session = ev.conversation_id
          handlers.onSession(session)
        }
        handlers.onInit?.('Google AI Pro', 'agy')
      } else if (ev.event === 'step_update' && ev.step_update) {
        const step = ev.step_update
        if (step.conversation_id && !session) {
          session = step.conversation_id
          handlers.onSession(session)
        }
        if (step.step_type === 'agent_response' && step.text_delta) {
          text += step.text_delta
          handlers.onDelta(step.text_delta)
        } else if (step.step_type === 'tool' && step.state === 'ACTIVE' && step.tool_name) {
          const summary = summarizeTool(step.tool_name, step.tool_info?.parameters)
          handlers.onActivity(summary.slice(0, 160))
        }

        if (step.usage) {
          usage.inputTokens = Math.max(usage.inputTokens, step.usage.input_tokens ?? 0)
          usage.outputTokens = Math.max(usage.outputTokens, step.usage.output_tokens ?? 0)
          usage.cacheReadTokens = Math.max(usage.cacheReadTokens, step.usage.cache_read_tokens ?? 0)
        }
      } else if (ev.event === 'result' && ev.result) {
        const res = ev.result
        if (res.conversation_id) {
          session = res.conversation_id
          handlers.onSession(session)
        }
        if (res.response) {
          resultText = res.response
        }
        if (res.usage) {
          usage.inputTokens = res.usage.input_tokens ?? usage.inputTokens
          usage.outputTokens = res.usage.output_tokens ?? usage.outputTokens
          usage.cacheReadTokens = res.usage.cache_read_tokens ?? usage.cacheReadTokens
        }
        if (res.status && res.status !== 'SUCCESS') {
          error = res.error ?? `Turn ended with status ${res.status}`
        }
      }
    },
  })

  usage.durationMs = Date.now() - started

  if (run.aborted) {
    error = 'Stopped.'
  } else if (run.exitCode !== 0 && !error) {
    const tail = run.stderr.trim().split('\n').slice(-3).join(' ').trim()
    error = tail || `agy exited with code ${run.exitCode}`
    if (/auth|login|credential/i.test(tail)) {
      error = `Antigravity CLI is not authenticated. Please run \`agy\` in a terminal to verify login. (${tail})`
    }
  }

  const finalText = (text.trim().length > 0 ? text : resultText).trim()
  const out: TurnResult = { text: error ? finalText : stripSkip(finalText), usage }
  if (error) out.error = error
  if (session) out.sessionId = session
  return out
}
