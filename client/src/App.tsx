import { useEffect, useReducer, useState } from 'react'
import type { ServerEvent } from '../../shared/types'
import { fetchState, sendMessageFull, stopRound } from './api'
import { ActivityLogsView } from './components/ActivityLogsView'
import { ApprovalCenterView } from './components/ApprovalCenterView'
import { BrowserManagerView } from './components/BrowserManagerView'
import { ChatView } from './components/ChatView'
import { Composer, type ReplyTarget } from './components/Composer'
import { DashboardView } from './components/DashboardView'
import { LeadManagerView } from './components/LeadManagerView'
import { MemoryManagerView } from './components/MemoryManagerView'
import { OutputManagerView } from './components/OutputManagerView'
import { Routines } from './components/Routines'
import { Settings, type SettingsSection } from './components/Settings'
import { SettingsView } from './components/SettingsView'
import { Skills } from './components/Skills'
import { TaskManagerView } from './components/TaskManagerView'
import { WorkspaceSidebar } from './components/WorkspaceSidebar'
import { initialState, reducer } from './state'

const LEAD_HUNT = 'workspace-lead-hunt'
const MARKETING = 'workspace-marketing'

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [activeId, setActiveId] = useState<string>('dashboard')
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<SettingsSection | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)

  // Dark/Light Theme state persisted in localStorage
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('ogb_theme')
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ogb_theme', theme)
  }, [theme])

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Zoom control persisted in localStorage
  const [zoom, setZoom] = useState<number>(() => {
    const saved = localStorage.getItem('ogb_zoom_level')
    return saved ? parseFloat(saved) : 1
  })

  const handleZoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(1.8, Math.round((prev + 0.1) * 10) / 10)
      localStorage.setItem('ogb_zoom_level', String(next))
      return next
    })
  }

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(0.7, Math.round((prev - 0.1) * 10) / 10)
      localStorage.setItem('ogb_zoom_level', String(next))
      return next
    })
  }

  const handleZoomReset = () => {
    setZoom(1)
    localStorage.setItem('ogb_zoom_level', '1')
  }

  // Ctrl + Plus, Ctrl + Minus, Ctrl + 0 keyboard listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          handleZoomIn()
        } else if (e.key === '-') {
          e.preventDefault()
          handleZoomOut()
        } else if (e.key === '0') {
          e.preventDefault()
          handleZoomReset()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Listen for agent provider update events dispatched from Providers or Settings components
  useEffect(() => {
    const handleUpdateAgentProvider = (e: Event) => {
      const custom = e as CustomEvent<{ id: string; provider: string }>
      if (custom.detail) {
        const { id, provider } = custom.detail
        const agent = state.team?.agents.find((a) => a.id === id)
        if (agent) {
          fetch(`/api/team/agents/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...agent, provider }),
          })
            .then(() => fetchState().then((s) => dispatch({ type: 'state', state: s })))
            .catch(() => {})
        }
      }
    }
    window.addEventListener('update-agent-provider', handleUpdateAgentProvider)
    return () => window.removeEventListener('update-agent-provider', handleUpdateAgentProvider)
  }, [state.team])

  // Restore active view from localStorage or default to dashboard
  useEffect(() => {
    const saved = localStorage.getItem('ogb_active_view')
    if (saved) setActiveId(saved)
  }, [])

  const handleSelectNav = (id: string) => {
    setReplyTo(null)
    setActiveId(id)
    localStorage.setItem('ogb_active_view', id)
  }

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchState()
        .then((snapshot) => {
          if (alive) dispatch({ type: 'state', state: snapshot })
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
    void load()
    const es = new EventSource('/api/events')
    es.onopen = () => {
      dispatch({ type: 'connected', connected: true })
      void load()
    }
    es.onerror = () => dispatch({ type: 'connected', connected: false })
    es.onmessage = (event) => {
      try {
        dispatch({ type: 'event', event: JSON.parse(event.data) as ServerEvent })
      } catch {
        // Ignore malformed event frames
      }
    }
    return () => {
      alive = false
      es.close()
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && settings) setSettings(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings])

  if (!state.team) {
    return <div className="boot">{error ? <p className="boot-error">Could not reach OpenGrokBot: {error}</p> : <p>Opening workspace…</p>}</div>
  }

  const isChatView = activeId === LEAD_HUNT || activeId === MARKETING
  const conversation = state.conversations.find((c) => c.id === activeId)
    ?? state.conversations.find((c) => c.id === LEAD_HUNT)
    ?? state.conversations[0]

  const busy = conversation ? state.busy.has(conversation.id) : false

  return (
    <div className="app workspace-app" data-theme={theme} style={{ zoom }}>
      <WorkspaceSidebar
        conversations={state.conversations}
        activeId={activeId}
        busy={state.busy}
        approvals={state.approvals}
        onSelect={handleSelectNav}
        onSettings={() => handleSelectNav('settings')}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="main workspace-main">
        {activeId === 'dashboard' && <DashboardView onNavigate={handleSelectNav} />}
        {activeId === 'leads' && <LeadManagerView onNavigateToMarketing={() => handleSelectNav(MARKETING)} />}
        {activeId === 'tasks' && <TaskManagerView onNavigateToApprovals={() => handleSelectNav('approvals')} />}
        {activeId === 'memory' && <MemoryManagerView />}
        {activeId === 'outputs' && <OutputManagerView />}
        {activeId === 'browser' && <BrowserManagerView />}
        {activeId === 'approvals' && <ApprovalCenterView />}
        {activeId === 'skills' && (
          <div className="management-view skills-view">
            <Skills team={state.team} />
          </div>
        )}
        {activeId === 'routines' && (
          <div className="management-view routines-view">
            <Routines team={state.team} conversations={state.conversations} routines={state.routines} />
          </div>
        )}
        {activeId === 'logs' && <ActivityLogsView />}
        {activeId === 'settings' && (
          <SettingsView
            team={state.team}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onNavigate={handleSelectNav}
          />
        )}

        {isChatView && conversation && (
          <>
            <ChatView
              team={state.team}
              conversation={conversation}
              typing={state.typing.get(conversation.id) ?? new Set()}
              usage={state.usage}
              approvals={state.approvals}
              jumpTo={null}
              onEditAgent={() => handleSelectNav('settings')}
              onReply={setReplyTo}
              profileOpen={false}
              onStop={() => void stopRound(conversation.id)}
            />
            <Composer
              team={state.team}
              conversation={conversation}
              busy={busy}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
              onSend={async (body) => {
                await sendMessageFull(conversation.id, body)
              }}
              onStop={() => void stopRound(conversation.id)}
            />
          </>
        )}

        {!state.connected && <div className="offline">Reconnecting…</div>}
        {error && (
          <div className="toast" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
      </main>

      {settings && (
        <Settings
          team={state.team}
          routines={state.routines}
          conversations={state.conversations}
          usage={state.usage}
          account={state.account}
          section={settings}
          onSection={setSettings}
          onClose={() => setSettings(null)}
          onEditAgent={() => undefined}
        />
      )}
    </div>
  )
}
