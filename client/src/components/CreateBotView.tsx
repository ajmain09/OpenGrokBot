import { useState } from 'react'
import type { Agent, Brand } from '../../../shared/types'
import { DEFAULT_BRANDS } from '../../../shared/types'
import { createAgent, generateBotConfig } from '../api'

interface CreateBotViewProps {
  brands?: Brand[]
  activeBrand: string
  onBotCreated?: (agent: Agent) => void
  onCancel?: () => void
}

export function CreateBotView({ brands, activeBrand, onBotCreated, onCancel }: CreateBotViewProps) {
  const brandList = brands && brands.length > 0 ? brands : DEFAULT_BRANDS
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')

  // AI Prompt Builder State
  const [aiPrompt, setAiPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedBot, setGeneratedBot] = useState<Partial<Agent> | null>(null)

  // Manual Form State
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [department, setDepartment] = useState('Operations')
  const [brandId, setBrandId] = useState(activeBrand || 'growthifyx')
  const [provider, setProvider] = useState<'antigravity' | 'codex'>('antigravity')
  const [approvals, setApprovals] = useState<'auto' | 'ask-dangerous' | 'ask-all'>('ask-dangerous')
  const [browserProfile, setBrowserProfile] = useState<'lead-hunt' | 'marketing' | 'none'>('none')
  const [outputFormat, setOutputFormat] = useState<'markdown' | 'csv' | 'json' | 'text'>('markdown')
  const [tools, setTools] = useState<string[]>(['Read', 'Glob', 'Grep', 'WebSearch'])
  const [personality, setPersonality] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const AVAILABLE_TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch']

  const handleGenerateAI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiPrompt.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const res = await generateBotConfig(aiPrompt.trim(), brandId)
      setGeneratedBot(res.agent)
      // Pre-fill manual form fields as well
      setName(res.agent.name)
      setRole(res.agent.role)
      setDepartment(res.agent.department || 'Operations')
      setTools(res.agent.tools || [])
      setPersonality(res.agent.personality)
      if (res.agent.browserProfile) setBrowserProfile(res.agent.browserProfile)
      if (res.agent.outputFormat) setOutputFormat(res.agent.outputFormat)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  const toggleTool = (tool: string) => {
    setTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]))
  }

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const idBase = (name.trim() || 'bot').toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const id = `${idBase}_${Date.now().toString(36)}`

      const newAgent: Agent = {
        id,
        name: name.trim().toUpperCase(),
        role: role.trim(),
        department: department.trim(),
        brandId,
        provider,
        model: 'default',
        effort: 'medium',
        color: '#18836B',
        shape: 'blob',
        personality: personality.trim() || `You are ${name.trim()}, a helpful AI employee for ${brandId}.`,
        tools,
        permissionMode: 'default',
        approvals,
        browserProfile,
        outputFormat,
        mcpServers: [],
        inheritClaudeSettings: false,
        autoApproveTools: approvals === 'auto',
        muted: false,
        version: 1,
        history: [],
      }

      const res = await createAgent(newAgent)
      onBotCreated?.(res.agent)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="management-view create-bot-view">
      <div className="management-header">
        <div>
          <h2>Create New AI Bot</h2>
          <p className="management-subtitle">
            Build specialized AI employees using natural language instructions or precise visual configuration.
          </p>
        </div>
        <div className="tab-bar" style={{ margin: 0 }}>
          <button
            type="button"
            className={`tab-btn ${mode === 'ai' ? 'is-active' : ''}`}
            onClick={() => setMode('ai')}
          >
            ✨ AI Prompt Builder
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'manual' ? 'is-active' : ''}`}
            onClick={() => setMode('manual')}
          >
            🛠️ Visual Config Form
          </button>
        </div>
      </div>

      {error && <div className="alert-box error">{error}</div>}

      {/* AI Builder Mode */}
      {mode === 'ai' && (
        <div className="card builder-ai-card">
          <h3>Describe your AI Employee</h3>
          <p className="mgmt-subtitle">
            Describe what you need in natural Bangla or English. Our AI architect will generate identity, instructions, tools, and permissions.
          </p>
          <form onSubmit={handleGenerateAI} className="ai-builder-form">
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Select Target Brand</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="filter-select"
                style={{ width: '240px' }}
              >
                {brandList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={4}
              placeholder="e.g. 'আমাকে দ্য সলভার এজেন্সির জন্য একজন বিটুবি লিড হান্টার বট বানিয়ে দাও, যে গুগল ও ফেসবুক থেকে রেস্তোরাঁ ও আইটি ফার্মের ফোন নম্বর সংগ্রহ করবে এবং ক্রোম প্রোফাইল ১ ব্যবহার করবে'…"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="builder-prompt-textarea"
              required
            />
            <div className="form-footer" style={{ marginTop: '10px' }}>
              <span className="task-hint">
                💡 Powered by Google Antigravity & OpenAI Codex engines.
              </span>
              <button type="submit" className="btn-primary" disabled={generating || !aiPrompt.trim()}>
                {generating ? 'Architecting Bot…' : '✨ Generate Bot Configuration'}
              </button>
            </div>
          </form>

          {/* Generated Bot Review */}
          {generatedBot && (
            <div className="generated-preview-card">
              <div className="preview-header">
                <h4>Generated Bot Proposal</h4>
                <span className="badge-verified">Ready for Review</span>
              </div>
              <div className="form-row-2">
                <div><strong>Name:</strong> {name}</div>
                <div><strong>Role:</strong> {role}</div>
              </div>
              <div className="form-row-2" style={{ marginTop: '6px' }}>
                <div><strong>Brand:</strong> {brandList.find((b) => b.id === brandId)?.name || brandId}</div>
                <div><strong>Provider:</strong> {provider === 'antigravity' ? 'Google Antigravity' : 'OpenAI Codex'}</div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>Enabled Tools:</strong> {tools.join(', ') || 'None'}
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>Instructions:</strong>
                <p className="preview-instructions">{personality}</p>
              </div>
              <div className="modal-actions" style={{ marginTop: '14px' }}>
                <button type="button" className="btn-secondary" onClick={() => setMode('manual')}>
                  Tweak in Form
                </button>
                <button type="button" className="btn-primary" onClick={handleFinalSubmit} disabled={saving}>
                  {saving ? 'Creating…' : '✓ Approve & Launch Bot'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Visual Form Mode */}
      {mode === 'manual' && (
        <form onSubmit={handleFinalSubmit} className="card form-grid manual-bot-card">
          <h3>Bot Identity & Work Parameters</h3>
          <div className="form-row-2">
            <div className="form-group">
              <label>Bot Name</label>
              <input
                type="text"
                placeholder="e.g. LEAD RESEARCHER"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <input
                type="text"
                placeholder="e.g. Market Research & Lead Discovery"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Assigned Brand</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
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
                placeholder="e.g. Lead Operations / Marketing"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>AI Brain Provider</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value as any)}>
                <option value="antigravity">Google Antigravity CLI (Google AI Pro)</option>
                <option value="codex">OpenAI Codex CLI (ChatGPT Subscription)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Execution Approval Policy</label>
              <select value={approvals} onChange={(e) => setApprovals(e.target.value as any)}>
                <option value="auto">Auto-Approve (Trusted execution)</option>
                <option value="ask-dangerous">Ask Dangerous (Confirm destructive/external)</option>
                <option value="ask-all">Ask All (Every tool requires approval)</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Assigned Chrome Profile</label>
              <select value={browserProfile} onChange={(e) => setBrowserProfile(e.target.value as any)}>
                <option value="none">None (Standard background execution)</option>
                <option value="lead-hunt">Profile 1 — Research & Lead Hunt</option>
                <option value="marketing">Profile 2 — Business & WhatsApp</option>
              </select>
            </div>
            <div className="form-group">
              <label>Output Format</label>
              <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as any)}>
                <option value="markdown">Markdown Report</option>
                <option value="csv">Excel-Compatible CSV</option>
                <option value="json">Structured JSON</option>
                <option value="text">Plain Text</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Authorized Tools</label>
            <div className="tools-selector-grid">
              {AVAILABLE_TOOLS.map((t) => {
                const isChecked = tools.includes(t)
                return (
                  <label key={t} className={`tool-chip-checkbox ${isChecked ? 'is-checked' : ''}`}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleTool(t)} />
                    <span>{t}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="form-group">
            <label>Instructions & System Guidelines (Bangla & English supported)</label>
            <textarea
              rows={5}
              placeholder="Define exact operating guidelines, output formats, knowledge rules, and constraints…"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Creating…' : 'Create & Launch Bot'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
