import { useState } from 'react'
import type { Agent, Brand, Team } from '../../../shared/types'
import { DEFAULT_BRANDS } from '../../../shared/types'
import { deleteAgent, duplicateAgent, restoreBotVersion, updateAgent } from '../api'

interface MyBotsViewProps {
  team: Team
  brands?: Brand[]
  activeBrand: string
  onRefreshTeam?: () => void
  onTestBot?: (bot: Agent) => void
  onCreateBotNavigate?: () => void
  onNavigate?: (id: string) => void
}

export function MyBotsView({
  team,
  brands,
  activeBrand,
  onRefreshTeam,
  onTestBot,
  onCreateBotNavigate,
  onNavigate,
}: MyBotsViewProps) {
  const brandList = brands && brands.length > 0 ? brands : DEFAULT_BRANDS
  const [brandFilter, setBrandFilter] = useState<string>(activeBrand || 'all')
  const [search, setSearch] = useState('')
  const [editingBot, setEditingBot] = useState<Agent | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Filter bots
  const filteredBots = team.agents.filter((bot) => {
    if (brandFilter !== 'all') {
      if (bot.brandId && bot.brandId !== brandFilter) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      const text = `${bot.name} ${bot.role} ${bot.department || ''} ${bot.scope || ''}`.toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  })

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateAgent(id)
      onRefreshTeam?.()
      setNotice('Bot cloned successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (bot: Agent) => {
    if (!window.confirm(`Are you sure you want to delete bot "${bot.name}"?`)) return
    try {
      await deleteAgent(bot.id)
      onRefreshTeam?.()
      setNotice(`Bot "${bot.name}" deleted.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBot) return
    setSaving(true)
    setError(null)
    try {
      await updateAgent(editingBot.id, editingBot)
      onRefreshTeam?.()
      setEditingBot(null)
      setNotice('Bot updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleRestoreVersion = async (version: number) => {
    if (!editingBot) return
    if (!window.confirm(`Restore bot configuration to Version ${version}?`)) return
    try {
      const res = await restoreBotVersion(editingBot.id, version)
      setEditingBot(res.agent)
      onRefreshTeam?.()
      setNotice(`Restored configuration to Version ${version}!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const toggleTool = (toolName: string) => {
    if (!editingBot) return
    const current = new Set(editingBot.tools)
    if (current.has(toolName)) current.delete(toolName)
    else current.add(toolName)
    setEditingBot({ ...editingBot, tools: Array.from(current) })
  }

  const AVAILABLE_TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch']

  return (
    <div className="management-view my-bots-view">
      <div className="management-header">
        <div>
          <h2>My AI Workforce</h2>
          <p className="management-subtitle">
            Manage, customize, and clone your AI bots across brands. Fully customizable execution permissions and memory.
          </p>
        </div>
        <div className="btn-group">
          <button type="button" className="btn-primary" onClick={onCreateBotNavigate || (() => onNavigate?.('create-bot'))}>
            + Create New Bot
          </button>
        </div>
      </div>

      {notice && (
        <div className="alert-box success">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="alert-close">✕</button>
        </div>
      )}
      {error && <div className="alert-box error">{error}</div>}

      {/* Filters Bar */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search bots by name, role, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="filter-select"
          aria-label="Filter by Brand"
        >
          <option value="all">All Brands ({team.agents.length})</option>
          {brandList.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Bots Grid */}
      <div className="bots-grid">
        {filteredBots.map((bot) => {
          const brandObj = brandList.find((b) => b.id === bot.brandId)
          const providerLabel =
            bot.provider === 'antigravity'
              ? 'Google Antigravity'
              : bot.provider === 'codex'
              ? 'OpenAI Codex'
              : bot.provider.toUpperCase()

          return (
            <div key={bot.id} className="card bot-card">
              <div className="bot-card-top">
                <div
                  className="bot-avatar"
                  style={{ backgroundColor: bot.color || '#18836B' }}
                >
                  {bot.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="bot-info-main">
                  <div className="bot-title-row">
                    <span className="bot-name">{bot.name}</span>
                    {brandObj && (
                      <span className="badge-brand" style={{ backgroundColor: `${brandObj.color || '#18836B'}15`, color: brandObj.color || '#18836B' }}>
                        {brandObj.name}
                      </span>
                    )}
                  </div>
                  <span className="bot-role">{bot.role}</span>
                  {bot.department && <span className="bot-dept">{bot.department}</span>}
                </div>
              </div>

              <p className="bot-desc-clamp">
                {bot.scope || bot.personality.slice(0, 140)}…
              </p>

              <div className="bot-meta-tags">
                <span className="meta-tag provider-tag" title="Connected AI Brain">
                  🧠 {providerLabel}
                </span>
                <span className="meta-tag tools-tag" title="Connected Tools">
                  ⚡ {bot.tools.length} Tools
                </span>
                <span className="meta-tag policy-tag" title="Approval Policy">
                  🛡️ {bot.approvals === 'auto' ? 'Auto-Approve' : bot.approvals === 'ask-all' ? 'Ask All' : 'Ask Dangerous'}
                </span>
                {bot.browserProfile && bot.browserProfile !== 'none' && (
                  <span className="meta-tag browser-tag" title="Assigned Browser Profile">
                    🌐 {bot.browserProfile === 'lead-hunt' ? 'Profile 1' : 'Profile 2'}
                  </span>
                )}
              </div>

              <div className="bot-card-actions">
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => onTestBot ? onTestBot(bot) : onNavigate?.(bot.id === 'marketing' ? 'workspace-marketing' : 'workspace-lead-hunt')}
                  title="Open Chat with this bot"
                >
                  💬 Chat & Test
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => setEditingBot(bot)}
                  title="Customize Bot Settings"
                >
                  ⚙️ Edit
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => handleDuplicate(bot.id)}
                  title="Clone this bot"
                >
                  📋 Clone
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-small text-danger"
                  onClick={() => handleDelete(bot)}
                  title="Delete bot"
                >
                  🗑️
                </button>
              </div>
            </div>
          )
        })}

        {filteredBots.length === 0 && (
          <div className="empty-state-box dot-grid-bg" style={{ gridColumn: '1 / -1' }}>
            <p className="empty-title">No bots found</p>
            <p className="empty-subtitle">Create a new customized bot or adjust your search filter.</p>
            <button type="button" className="btn-primary" onClick={onCreateBotNavigate} style={{ marginTop: '12px' }}>
              + Create Bot Now
            </button>
          </div>
        )}
      </div>

      {/* Edit Bot Customization Modal */}
      {editingBot && (
        <div className="modal-backdrop" onClick={() => setEditingBot(null)}>
          <div className="modal-card bot-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Customize Bot: {editingBot.name}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setEditingBot(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="form-grid">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Bot Name</label>
                  <input
                    type="text"
                    value={editingBot.name}
                    onChange={(e) => setEditingBot({ ...editingBot, name: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <input
                    type="text"
                    value={editingBot.role}
                    onChange={(e) => setEditingBot({ ...editingBot, role: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Assigned Brand</label>
                  <select
                    value={editingBot.brandId || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, brandId: e.target.value || undefined })}
                  >
                    <option value="">Shared (All Brands)</option>
                    {brandList.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    value={editingBot.department || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, department: e.target.value })}
                    placeholder="e.g. Lead Operations / Marketing"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>AI Brain Engine</label>
                  <select
                    value={editingBot.provider}
                    onChange={(e) => setEditingBot({ ...editingBot, provider: e.target.value })}
                  >
                    <option value="antigravity">Google Antigravity CLI (Google AI Pro)</option>
                    <option value="codex">OpenAI Codex CLI (ChatGPT Subscription)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Execution Approval Policy</label>
                  <select
                    value={editingBot.approvals}
                    onChange={(e) => setEditingBot({ ...editingBot, approvals: e.target.value as any })}
                  >
                    <option value="auto">Auto-Approve (Trusted execution)</option>
                    <option value="ask-dangerous">Ask Dangerous (Confirm destructive/external)</option>
                    <option value="ask-all">Ask All (Every tool requires approval)</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Dedicated Browser Profile</label>
                  <select
                    value={editingBot.browserProfile || 'none'}
                    onChange={(e) => setEditingBot({ ...editingBot, browserProfile: e.target.value as any })}
                  >
                    <option value="none">None (Standard execution)</option>
                    <option value="lead-hunt">Profile 1 — Research & Lead Hunt</option>
                    <option value="marketing">Profile 2 — Business & WhatsApp</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Preferred Output Format</label>
                  <select
                    value={editingBot.outputFormat || 'markdown'}
                    onChange={(e) => setEditingBot({ ...editingBot, outputFormat: e.target.value as any })}
                  >
                    <option value="markdown">Markdown Report</option>
                    <option value="csv">Excel-Compatible CSV</option>
                    <option value="json">Structured JSON</option>
                    <option value="text">Plain Text Draft</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Enabled Tools</label>
                <div className="tools-selector-grid">
                  {AVAILABLE_TOOLS.map((t) => {
                    const isChecked = editingBot.tools.includes(t)
                    return (
                      <label key={t} className={`tool-chip-checkbox ${isChecked ? 'is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTool(t)}
                        />
                        <span>{t}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="form-group">
                <label>System Instructions & Personality (Bangla & English supported)</label>
                <textarea
                  rows={5}
                  value={editingBot.personality}
                  onChange={(e) => setEditingBot({ ...editingBot, personality: e.target.value })}
                  placeholder="Define exact operating guidelines, tone, knowledge, and restrictions…"
                  required
                />
              </div>

              {/* Version History & Restore */}
              {editingBot.history && editingBot.history.length > 0 && (
                <div className="version-history-box">
                  <label>Configuration History</label>
                  <div className="version-list">
                    {editingBot.history.map((h) => (
                      <div key={h.version} className="version-row">
                        <span>Version {h.version} ({new Date(h.updatedAt).toLocaleTimeString()})</span>
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => handleRestoreVersion(h.version)}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingBot(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
