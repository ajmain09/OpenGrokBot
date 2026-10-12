import { useState } from 'react'
import { testTool } from '../api'

interface ToolItem {
  id: string
  name: string
  category: 'computer' | 'browser' | 'intelligence' | 'providers'
  description: string
  defaultPermission: 'allow' | 'ask' | 'deny'
  status: 'connected' | 'untested' | 'testing' | 'error'
  lastMessage?: string
}

const DEFAULT_TOOLS: ToolItem[] = [
  {
    id: 'computer.screenshot',
    name: 'Screen Snapshot Capture',
    category: 'computer',
    description: 'Captures full Windows desktop display via native PowerShell GDI+ without external tools.',
    defaultPermission: 'allow',
    status: 'untested',
  },
  {
    id: 'computer.powershell',
    name: 'PowerShell Automation Engine',
    category: 'computer',
    description: 'Executes authorized Windows system commands and background automation scripts.',
    defaultPermission: 'ask',
    status: 'untested',
  },
  {
    id: 'computer.filesystem',
    name: 'Filesystem I/O Manager',
    category: 'computer',
    description: 'Reads and writes lead CSV exports, generated marketing drafts, and screenshots.',
    defaultPermission: 'allow',
    status: 'untested',
  },
  {
    id: 'browser.playwright',
    name: 'Playwright Browser Automation',
    category: 'browser',
    description: 'Automates Chromium browser navigation, DOM inspection, and form interactions.',
    defaultPermission: 'allow',
    status: 'untested',
  },
  {
    id: 'browser.chrome_profiles',
    name: 'Dedicated Chrome Profiles',
    category: 'browser',
    description: 'Isolated persistent Chrome environments for Lead Research (Profile 1) and WhatsApp Business (Profile 2).',
    defaultPermission: 'allow',
    status: 'untested',
  },
  {
    id: 'intelligence.web_search',
    name: 'Web Intelligence & Search',
    category: 'intelligence',
    description: 'Automated search engine querying and corporate directory scraping.',
    defaultPermission: 'allow',
    status: 'untested',
  },
  {
    id: 'intelligence.lead_extractor',
    name: 'Business Lead Extractor & Deduplicator',
    category: 'intelligence',
    description: 'Extracts contact info, phone numbers, and addresses from webpages, checking for duplicates.',
    defaultPermission: 'allow',
    status: 'untested',
  },
  {
    id: 'provider.antigravity',
    name: 'Google Antigravity CLI (Primary Engine)',
    category: 'providers',
    description: 'Local Google Antigravity CLI agent runtime using existing Google AI Pro authenticated session.',
    defaultPermission: 'allow',
    status: 'untested',
  },
  {
    id: 'provider.codex',
    name: 'OpenAI Codex CLI (Secondary Engine)',
    category: 'providers',
    description: 'OpenAI Codex CLI execution runtime using local authenticated credentials.',
    defaultPermission: 'allow',
    status: 'untested',
  },
]

export function ToolsAndIntegrationsView() {
  const [tools, setTools] = useState<ToolItem[]>(() => {
    const saved = localStorage.getItem('ogb_tools_permissions')
    if (saved) {
      try {
        const perms = JSON.parse(saved) as Record<string, 'allow' | 'ask' | 'deny'>
        return DEFAULT_TOOLS.map((t) => ({
          ...t,
          defaultPermission: perms[t.id] ?? t.defaultPermission,
        }))
      } catch {
        return DEFAULT_TOOLS
      }
    }
    return DEFAULT_TOOLS
  })

  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [testingAll, setTestingAll] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const handlePermissionChange = (id: string, perm: 'allow' | 'ask' | 'deny') => {
    setTools((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, defaultPermission: perm } : t))
      const permMap: Record<string, string> = {}
      for (const t of next) {
        permMap[t.id] = t.defaultPermission
      }
      localStorage.setItem('ogb_tools_permissions', JSON.stringify(permMap))
      return next
    })
    setNotice(`Updated permission for ${id} to ${perm.toUpperCase()}`)
  }

  const handleTestTool = async (id: string) => {
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'testing', lastMessage: 'Testing connection…' } : t))
    )

    try {
      const res = await testTool(id)
      setTools((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: res.ok ? 'connected' : 'error',
                lastMessage: res.message,
              }
            : t
        )
      )
    } catch (err) {
      setTools((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'error',
                lastMessage: err instanceof Error ? err.message : String(err),
              }
            : t
        )
      )
    }
  }

  const handleTestAll = async () => {
    setTestingAll(true)
    for (const tool of tools) {
      await handleTestTool(tool.id)
    }
    setTestingAll(false)
  }

  const filteredTools =
    activeCategory === 'all' ? tools : tools.filter((t) => t.category === activeCategory)

  return (
    <div className="management-view tools-view">
      <div className="management-header">
        <div>
          <h2>Tools & MCP Integrations Catalog</h2>
          <p className="management-subtitle">
            Configure system permissions (ALLOW, ASK, DENY) and verify live tool connectivity for computer, browser, and AI execution.
          </p>
        </div>
        <div className="btn-group">
          <button
            type="button"
            className="btn-primary"
            onClick={handleTestAll}
            disabled={testingAll}
          >
            {testingAll ? 'Testing All Tools…' : '⚡ Test All Connections'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="alert-box success">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="alert-close">
            ✕
          </button>
        </div>
      )}

      {/* Security notice banner */}
      <div className="card notice-banner">
        <h4>🛡️ Permission Levels:</h4>
        <p>
          • <strong>ALLOW:</strong> Automated execution without nagging. Recommended for read-only lookups, screenshots, and internal workflows.
          <br />
          • <strong>ASK:</strong> Owner confirmation required in Approval Center before executing destructive actions, WhatsApp dispatches, or shell commands.
          <br />
          • <strong>DENY:</strong> Tool is permanently blocked from execution by any bot.
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          All Tools ({tools.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeCategory === 'computer' ? 'active' : ''}`}
          onClick={() => setActiveCategory('computer')}
        >
          Windows Computer Control
        </button>
        <button
          type="button"
          className={`tab-btn ${activeCategory === 'browser' ? 'active' : ''}`}
          onClick={() => setActiveCategory('browser')}
        >
          Browser & Playwright
        </button>
        <button
          type="button"
          className={`tab-btn ${activeCategory === 'intelligence' ? 'active' : ''}`}
          onClick={() => setActiveCategory('intelligence')}
        >
          Lead Intelligence
        </button>
        <button
          type="button"
          className={`tab-btn ${activeCategory === 'providers' ? 'active' : ''}`}
          onClick={() => setActiveCategory('providers')}
        >
          AI Providers
        </button>
      </div>

      {/* Tools List Grid */}
      <div className="tools-grid">
        {filteredTools.map((tool) => (
          <div key={tool.id} className="card tool-card">
            <div className="tool-card-header">
              <div>
                <span className="tool-category-badge">{tool.category.toUpperCase()}</span>
                <h3 className="tool-name">{tool.name}</h3>
                <code className="tool-id-code">{tool.id}</code>
              </div>
              <div className="tool-status-badge">
                {tool.status === 'connected' && <span className="status-pill pill-verified">● Connected</span>}
                {tool.status === 'testing' && <span className="status-pill pill-unverified">⌛ Testing…</span>}
                {tool.status === 'error' && <span className="status-pill pill-error">✕ Error</span>}
                {tool.status === 'untested' && <span className="status-pill pill-idle">○ Untested</span>}
              </div>
            </div>

            <p className="tool-description">{tool.description}</p>

            {tool.lastMessage && (
              <div className={`tool-message ${tool.status === 'error' ? 'message-error' : 'message-ok'}`}>
                {tool.lastMessage}
              </div>
            )}

            <div className="tool-card-footer">
              <div className="permission-selector">
                <span className="perm-label">Permission:</span>
                <div className="perm-toggle-group">
                  <button
                    type="button"
                    className={`perm-btn perm-allow ${tool.defaultPermission === 'allow' ? 'is-selected' : ''}`}
                    onClick={() => handlePermissionChange(tool.id, 'allow')}
                    title="Allow execution automatically"
                  >
                    ALLOW
                  </button>
                  <button
                    type="button"
                    className={`perm-btn perm-ask ${tool.defaultPermission === 'ask' ? 'is-selected' : ''}`}
                    onClick={() => handlePermissionChange(tool.id, 'ask')}
                    title="Require approval before execution"
                  >
                    ASK
                  </button>
                  <button
                    type="button"
                    className={`perm-btn perm-deny ${tool.defaultPermission === 'deny' ? 'is-selected' : ''}`}
                    onClick={() => handlePermissionChange(tool.id, 'deny')}
                    title="Deny execution completely"
                  >
                    DENY
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => handleTestTool(tool.id)}
                disabled={tool.status === 'testing'}
              >
                {tool.status === 'testing' ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

