import { useEffect, useState } from 'react'
import type { Brand, ProviderStatus, Team, WhatsAppBrandConfig } from '../../../shared/types'
import {
  clearMemories,
  createBrand,
  deleteBrand,
  fetchBrands,
  fetchWhatsAppConfig,
  updateWhatsAppConfig,
  sendWhatsAppMessage,
  listBrowsers,
  listOutputs,
  openBrowserProfile,
  openOutputFolder,
  providerStatuses,
  updateAgent,
  updateBrand,
  updateOutputsDir,
} from '../api'

interface SettingsViewProps {
  team: Team
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onNavigate: (viewId: string) => void
  activeBrand?: string
  onBrandChange?: (brandId: string) => void
}

type SettingsTab = 'general' | 'brands' | 'whatsapp' | 'providers' | 'automation' | 'memory' | 'outputs' | 'permissions' | 'system'

export function SettingsView({
  team,
  theme,
  onToggleTheme,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onNavigate,
  activeBrand = 'growthifyx',
  onBrandChange,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const saved = localStorage.getItem('ogb_settings_tab') as SettingsTab | null
    return saved || 'general'
  })

  const [statuses, setStatuses] = useState<ProviderStatus[]>([])
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Multi-brand state
  const [brands, setBrands] = useState<Brand[]>([])
  const [loadingBrands, setLoadingBrands] = useState(false)
  const [showBrandForm, setShowBrandForm] = useState(false)
  const [brandFormName, setBrandFormName] = useState('')
  const [brandFormTagline, setBrandFormTagline] = useState('')
  const [brandFormDesc, setBrandFormDesc] = useState('')
  const [brandFormColor, setBrandFormColor] = useState('#18836B')
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null)

  // Outputs directory state
  const [baseDir, setBaseDir] = useState('')
  const [dirInput, setDirInput] = useState('')
  const [editingDir, setEditingDir] = useState(false)

  // WhatsApp Meta Cloud API state
  const [waBrandId, setWaBrandId] = useState<string>(activeBrand)
  const [waConfig, setWaConfig] = useState<WhatsAppBrandConfig | null>(null)
  const [waPhoneId, setWaPhoneId] = useState('')
  const [waWabaId, setWaWabaId] = useState('')
  const [waToken, setWaToken] = useState('')
  const [waVerifyToken, setWaVerifyToken] = useState('')
  const [waAutoReply, setWaAutoReply] = useState(true)
  const [waAutoMarketing, setWaAutoMarketing] = useState(true)
  const [waSaving, setWaSaving] = useState(false)
  const [waTestRecipient, setWaTestRecipient] = useState('')
  const [waTestMessage, setWaTestMessage] = useState('')
  const [waTestStatus, setWaTestStatus] = useState<string | null>(null)

  const loadWaConfig = async (bid: string) => {
    try {
      const cfg = await fetchWhatsAppConfig(bid)
      setWaConfig(cfg)
      setWaPhoneId(cfg.phoneNumberId || '')
      setWaWabaId(cfg.wabaId || '')
      setWaToken(cfg.accessToken || '')
      setWaVerifyToken(cfg.webhookVerifyToken || '')
      setWaAutoReply(cfg.autoReplyEnabled ?? true)
      setWaAutoMarketing(cfg.autoMarketingEnabled ?? true)
    } catch {
      // fallback
    }
  }

  useEffect(() => {
    void loadWaConfig(waBrandId)
  }, [waBrandId])

  const handleSaveWaConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setWaSaving(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await updateWhatsAppConfig(waBrandId, {
        phoneNumberId: waPhoneId.trim(),
        wabaId: waWabaId.trim(),
        accessToken: waToken.trim(),
        webhookVerifyToken: waVerifyToken.trim() || `ogb_verify_${waBrandId}_2026`,
        autoReplyEnabled: waAutoReply,
        autoMarketingEnabled: waAutoMarketing,
        enabled: true,
      })
      setWaConfig(updated)
      setNotice(`WhatsApp settings for ${waBrandId.toUpperCase()} saved successfully!`)
      setTimeout(() => setNotice(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setWaSaving(false)
    }
  }

  const handleSendTestWa = async () => {
    if (!waTestRecipient.trim() || !waTestMessage.trim()) return
    setWaTestStatus('Sending…')
    try {
      const res = await sendWhatsAppMessage({
        brandId: waBrandId,
        recipientPhone: waTestRecipient.trim(),
        message: waTestMessage.trim(),
      })
      if (res.ok) {
        setWaTestStatus(`Message ${res.status.toUpperCase()} (ID: ${res.messageId.slice(0, 8)})`)
      } else {
        setWaTestStatus(`Failed: ${res.error}`)
      }
    } catch (err) {
      setWaTestStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const leadAgent = team.agents.find((a) => a.id === 'lead_collection_specialist')
  const marketingAgent = team.agents.find((a) => a.id === 'marketing')

  const handleSelectTab = (tab: SettingsTab) => {
    setActiveTab(tab)
    localStorage.setItem('ogb_settings_tab', tab)
  }

  const loadBrands = async () => {
    setLoadingBrands(true)
    try {
      const data = await fetchBrands()
      setBrands(data)
    } catch {
      // ignore
    } finally {
      setLoadingBrands(false)
    }
  }

  const refreshProviders = async (force = false) => {
    setChecking(true)
    try {
      const data = await providerStatuses(force)
      setStatuses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setChecking(false)
    }
  }

  const loadOutputs = async () => {
    try {
      const data = await listOutputs()
      setBaseDir(data.dir)
      setDirInput(data.dir)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshProviders()
    void loadOutputs()
    void loadBrands()
  }, [])

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brandFormName.trim()) return
    setError(null)
    try {
      if (editingBrandId) {
        await updateBrand(editingBrandId, {
          name: brandFormName.trim(),
          tagline: brandFormTagline.trim(),
          description: brandFormDesc.trim(),
          color: brandFormColor,
        })
        setNotice(`Brand "${brandFormName.trim()}" updated successfully!`)
      } else {
        await createBrand({
          name: brandFormName.trim(),
          tagline: brandFormTagline.trim(),
          description: brandFormDesc.trim(),
          color: brandFormColor,
        })
        setNotice(`New brand "${brandFormName.trim()}" created successfully!`)
      }
      setShowBrandForm(false)
      setEditingBrandId(null)
      setBrandFormName('')
      setBrandFormTagline('')
      setBrandFormDesc('')
      setBrandFormColor('#18836B')
      await loadBrands()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDeleteBrand = async (id: string, name: string) => {
    if (brands.length <= 1) {
      setError('You must keep at least one brand workspace.')
      return
    }
    if (!window.confirm(`Are you sure you want to delete brand "${name}"?`)) return
    try {
      await deleteBrand(id)
      setNotice(`Brand "${name}" removed.`)
      if (activeBrand === id) {
        const remaining = brands.find((b) => b.id !== id)
        if (remaining && onBrandChange) onBrandChange(remaining.id)
      }
      await loadBrands()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleStartEditBrand = (b: Brand) => {
    setEditingBrandId(b.id)
    setBrandFormName(b.name)
    setBrandFormTagline(b.tagline || '')
    setBrandFormDesc(b.description || '')
    setBrandFormColor(b.color || '#18836B')
    setShowBrandForm(true)
  }

  const handleSaveOutputDir = async () => {
    if (!dirInput.trim()) return
    try {
      const res = await updateOutputsDir(dirInput.trim())
      setBaseDir(res.dir)
      setEditingDir(false)
      setNotice('Output directory updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const agyStatus = statuses.find((s) => s.id === 'antigravity' || s.kind === 'antigravity')
  const codexStatus = statuses.find((s) => s.id === 'codex' || s.kind === 'codex')

  return (
    <div className="management-view settings-view">
      <div className="management-header">
        <div>
          <h2>Settings & System Control</h2>
          <p className="management-subtitle">
            Configure AI provider engines, local output paths, automated routines, and security permissions.
          </p>
        </div>
        <div className="btn-group">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void refreshProviders(true)}
            disabled={checking}
          >
            {checking ? 'Probing…' : 'Re-check Providers'}
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

      {/* 7 Compact Settings Tabs */}
      <div className="tab-bar settings-tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => handleSelectTab('general')}
        >
          GENERAL
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'brands' ? 'active' : ''}`}
          onClick={() => handleSelectTab('brands')}
        >
          BRANDS ({brands.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'whatsapp' ? 'active' : ''}`}
          onClick={() => handleSelectTab('whatsapp')}
        >
          WHATSAPP CLOUD API
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'providers' ? 'active' : ''}`}
          onClick={() => handleSelectTab('providers')}
        >
          AI PROVIDERS
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'automation' ? 'active' : ''}`}
          onClick={() => handleSelectTab('automation')}
        >
          AUTOMATION
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'memory' ? 'active' : ''}`}
          onClick={() => handleSelectTab('memory')}
        >
          MEMORY
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'outputs' ? 'active' : ''}`}
          onClick={() => handleSelectTab('outputs')}
        >
          OUTPUTS
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'permissions' ? 'active' : ''}`}
          onClick={() => handleSelectTab('permissions')}
        >
          PERMISSIONS
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => handleSelectTab('system')}
        >
          SYSTEM
        </button>
      </div>

      {/* TAB 1: GENERAL */}
      {activeTab === 'general' && (
        <div className="card section-card">
          <div className="section-head">
            <h3>🎨 Appearance & Typography</h3>
          </div>

          <div className="settings-grid-rows">
            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">Color Theme</strong>
                <span className="setting-hint">Toggle between clean dark theme and elegant light theme.</span>
              </div>
              <div className="setting-action">
                <button type="button" className="btn-secondary" onClick={onToggleTheme}>
                  {theme === 'dark' ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">Interface Zoom Level</strong>
                <span className="setting-hint">Keyboard shortcuts: Ctrl + / Ctrl - / Ctrl 0</span>
              </div>
              <div className="setting-action">
                <div className="zoom-controls-bar">
                  <button type="button" className="zoom-btn" onClick={onZoomOut}>−</button>
                  <button type="button" className="zoom-btn zoom-val" onClick={onZoomReset}>
                    {Math.round(zoom * 100)}%
                  </button>
                  <button type="button" className="zoom-btn" onClick={onZoomIn}>+</button>
                </div>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">Bangla Typography & Font Rendering</strong>
                <span className="setting-hint">
                  Optimized system fallback stack: Nirmala UI, Kalpurush, SolaimanLipi, Noto Sans Bengali.
                </span>
              </div>
              <div className="setting-action">
                <span className="sample-bangla-text">OpenGrokBot — বাংলা এআই সহকারী ও লিড হান্টার</span>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">Workspace Owner</strong>
                <span className="setting-hint">Identifies the team administrator across chat turns.</span>
              </div>
              <div className="setting-action">
                <strong>{team.owner.name} ({team.owner.title})</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: BRANDS */}
      {activeTab === 'brands' && (
        <div className="card section-card">
          <div className="section-head">
            <div>
              <h3>🏢 Multi-Brand Workspaces</h3>
              <p className="section-desc">
                Organize bots, leads, memory, tasks, and outputs into fully isolated brand workspaces.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditingBrandId(null)
                setBrandFormName('')
                setBrandFormTagline('')
                setBrandFormDesc('')
                setBrandFormColor('#18836B')
                setShowBrandForm(true)
              }}
            >
              + Add New Brand
            </button>
          </div>

          {showBrandForm && (
            <form className="card brand-edit-form" onSubmit={handleSaveBrand} style={{ marginTop: '16px', marginBottom: '20px' }}>
              <h4>{editingBrandId ? 'Edit Brand Workspace' : 'Create New Brand Workspace'}</h4>
              <div className="form-group">
                <label>Brand Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Growthifyx, The Solver Agency"
                  value={brandFormName}
                  onChange={(e) => setBrandFormName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Tagline / Motto</label>
                <input
                  type="text"
                  placeholder="e.g. Scaling Local Brands with Automated Outreach"
                  value={brandFormTagline}
                  onChange={(e) => setBrandFormTagline(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Brand Description & Mission</label>
                <textarea
                  rows={2}
                  placeholder="Short description of the company and target clients"
                  value={brandFormDesc}
                  onChange={(e) => setBrandFormDesc(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Theme Color Hex</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={brandFormColor}
                    onChange={(e) => setBrandFormColor(e.target.value)}
                    style={{ width: '40px', height: '36px', padding: '0', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={brandFormColor}
                    onChange={(e) => setBrandFormColor(e.target.value)}
                    style={{ width: '120px' }}
                  />
                </div>
              </div>
              <div className="btn-group" style={{ marginTop: '12px' }}>
                <button type="submit" className="btn-primary">
                  {editingBrandId ? 'Save Changes' : 'Create Brand'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowBrandForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="brands-list-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
            {brands.map((b) => {
              const isActive = b.id === activeBrand
              return (
                <div key={b.id} className="card brand-card" style={{ borderLeft: `4px solid ${b.color || '#18836B'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0' }}>{b.name}</h4>
                      <code style={{ fontSize: '0.75rem' }}>{b.id}</code>
                    </div>
                    {isActive ? (
                      <span className="status-pill pill-verified">● Active Workspace</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => onBrandChange?.(b.id)}
                      >
                        Switch to Brand
                      </button>
                    )}
                  </div>
                  {b.tagline && <p style={{ fontSize: '0.85rem', margin: '8px 0 4px 0', color: 'var(--text-secondary)' }}>{b.tagline}</p>}
                  {b.description && <p style={{ fontSize: '0.8rem', margin: '4px 0', color: 'var(--text-tertiary)' }}>{b.description}</p>}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => handleStartEditBrand(b)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger-ghost btn-sm"
                      onClick={() => handleDeleteBrand(b.id, b.name)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB: WHATSAPP CLOUD API */}
      {activeTab === 'whatsapp' && (
        <div className="card section-card">
          <div className="section-head">
            <div>
              <h3>📱 Meta WhatsApp Business Cloud API & Messaging</h3>
              <p className="section-desc">
                Configure direct Meta Graph API credentials for automated customer communication, Bengali/English auto-replies, and scheduled marketing outreach.
              </p>
            </div>
            <div className="brand-badge-group">
              <span
                className="status-pill"
                style={{
                  backgroundColor: waConfig?.status === 'connected' ? '#18836B' : '#d97706',
                  color: '#fff',
                }}
              >
                {waConfig?.status === 'connected' ? 'CONNECTED' : 'SETUP REQUIRED'}
              </span>
            </div>
          </div>

          {/* Brand Selector for WhatsApp settings */}
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontWeight: 600, fontSize: '13px' }}>Configure for Brand:</label>
            <select
              value={waBrandId}
              onChange={(e) => setWaBrandId(e.target.value)}
              className="select"
              style={{ maxWidth: '240px' }}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.id})
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSaveWaConfig} style={{ marginTop: '16px' }}>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Phone Number ID (From Meta Developer Portal)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 104829104829104"
                value={waPhoneId}
                onChange={(e) => setWaPhoneId(e.target.value)}
              />
              <span className="form-hint" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Located in your Meta WhatsApp App Dashboard &gt; API Setup &gt; Phone number ID.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">WhatsApp Business Account ID (WABA ID)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 192847192847192"
                value={waWabaId}
                onChange={(e) => setWaWabaId(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">System User Permanent Access Token</label>
              <input
                type="password"
                className="form-input"
                placeholder="EAAB..."
                value={waToken}
                onChange={(e) => setWaToken(e.target.value)}
              />
              <span className="form-hint" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Token with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code> permissions.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Webhook Verify Token</label>
              <input
                type="text"
                className="form-input"
                value={waVerifyToken}
                onChange={(e) => setWaVerifyToken(e.target.value)}
              />
              <span className="form-hint" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Set your Meta Webhook URL to: <code>http://&lt;your-domain-or-tunnel&gt;/api/whatsapp/webhook</code>
              </span>
            </div>

            {/* Autonomous Mode Toggles */}
            <div style={{ marginTop: '18px', padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-subtle, #f9f9f9)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>⚡ Autonomous Operation Controls:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={waAutoReply}
                    onChange={(e) => setWaAutoReply(e.target.checked)}
                  />
                  <div>
                    <strong style={{ fontSize: '13px' }}>Autonomous Auto-Reply (Inbound Messages)</strong>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Automatically reply to incoming customer inquiries in natural Bengali/English without requiring manual owner approval for each reply.
                    </span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={waAutoMarketing}
                    onChange={(e) => setWaAutoMarketing(e.target.checked)}
                  />
                  <div>
                    <strong style={{ fontSize: '13px' }}>Autonomous Outbound Marketing Outreach</strong>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Authorize Marketing bot to send scheduled proposal campaigns to verified leads directly via WhatsApp Cloud API without per-message confirmation.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="submit" className="btn-primary" disabled={waSaving}>
                {waSaving ? 'Saving…' : 'Save WhatsApp Configuration'}
              </button>
            </div>
          </form>

          {/* Test Messenger Card */}
          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <h4>📨 Direct WhatsApp Dispatch Test</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Send a test message to verify Meta Cloud API connectivity or queue a draft for WhatsApp Web.
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <input
                type="text"
                placeholder="Recipient Phone (+88017...)"
                value={waTestRecipient}
                onChange={(e) => setWaTestRecipient(e.target.value)}
                className="form-input"
                style={{ maxWidth: '240px' }}
              />
              <input
                type="text"
                placeholder="Message body"
                value={waTestMessage}
                onChange={(e) => setWaTestMessage(e.target.value)}
                className="form-input"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSendTestWa}
                disabled={!waTestRecipient.trim() || !waTestMessage.trim()}
              >
                Send Test
              </button>
            </div>
            {waTestStatus && (
              <p style={{ marginTop: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
                {waTestStatus}
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AI PROVIDERS */}
      {activeTab === 'providers' && (
        <div className="card section-card">
          <div className="section-head">
            <h3>⚡ AI Providers</h3>
            <span className="badge-online">Subscription Mode Active</span>
          </div>
          <p className="section-desc">
            OpenGrokBot operates directly through official CLI tools using your existing Google AI Pro and ChatGPT subscriptions. No pay-per-token API fees or extra secret keys are required.
          </p>

          <div className="settings-grid-rows">
            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">LEAD HUNT Engine (Research & Lead Collection)</strong>
                <span className="setting-hint">
                  Current provider: {leadAgent?.provider === 'codex' ? 'OpenAI Codex CLI' : 'Google Antigravity CLI (Default)'}
                </span>
              </div>
              <div className="setting-action">
                <select
                  value={leadAgent?.provider || 'antigravity'}
                  onChange={async (e) => {
                    await updateAgent('lead_collection_specialist', { provider: e.target.value })
                    window.dispatchEvent(
                      new CustomEvent('update-agent-provider', {
                        detail: { id: 'lead_collection_specialist', provider: e.target.value },
                      })
                    )
                    setNotice('LEAD HUNT provider updated successfully!')
                  }}
                  className="select"
                >
                  <option value="antigravity">Google Antigravity (Google AI Pro - Default)</option>
                  <option value="codex">OpenAI Codex (ChatGPT Subscription)</option>
                </select>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">MARKETING Engine (Outreach & Messaging)</strong>
                <span className="setting-hint">
                  Current provider: {marketingAgent?.provider === 'codex' ? 'OpenAI Codex CLI' : 'Google Antigravity CLI (Default)'}
                </span>
              </div>
              <div className="setting-action">
                <select
                  value={marketingAgent?.provider || 'antigravity'}
                  onChange={async (e) => {
                    await updateAgent('marketing', { provider: e.target.value })
                    window.dispatchEvent(
                      new CustomEvent('update-agent-provider', {
                        detail: { id: 'marketing', provider: e.target.value },
                      })
                    )
                    setNotice('MARKETING provider updated successfully!')
                  }}
                  className="select"
                >
                  <option value="antigravity">Google Antigravity (Google AI Pro - Default)</option>
                  <option value="codex">OpenAI Codex (ChatGPT Subscription)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Provider Status Cards */}
          <div className="provider-status-grid">
            <div className="card provider-card">
              <div className="provider-card-head">
                <div className="provider-badge-group">
                  <span className={`status-dot ${agyStatus?.ok ? 'ok' : 'bad'}`} />
                  <h4>Google Antigravity (agy)</h4>
                </div>
                <span className="badge-default">Default</span>
              </div>
              <p className="provider-card-detail">
                {agyStatus ? agyStatus.detail : 'Google AI Pro · Native Antigravity CLI'}
              </p>
            </div>

            <div className="card provider-card">
              <div className="provider-card-head">
                <div className="provider-badge-group">
                  <span className={`status-dot ${codexStatus?.ok ? 'ok' : 'bad'}`} />
                  <h4>OpenAI Codex (codex)</h4>
                </div>
                <span className="badge-alt">Secondary</span>
              </div>
              <p className="provider-card-detail">
                {codexStatus ? codexStatus.detail : 'ChatGPT Subscription · Codex CLI'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATION */}
      {activeTab === 'automation' && (
        <div className="card section-card">
          <div className="section-head">
            <h3>⏰ Automation & Background Tasks</h3>
          </div>
          <p className="section-desc">
            Configure automated scheduling, cron routines, and browser profile automation.
          </p>

          <div className="settings-grid-rows">
            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">Automation Routines</strong>
                <span className="setting-hint">Schedule recurring agent jobs via cron or external webhooks.</span>
              </div>
              <div className="setting-action">
                <button type="button" className="btn-secondary" onClick={() => onNavigate('routines')}>
                  Manage Routines →
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">Skills & Tool Catalog</strong>
                <span className="setting-hint">Manage reusable slash-command prompts and tool definitions.</span>
              </div>
              <div className="setting-action">
                <button type="button" className="btn-secondary" onClick={() => onNavigate('skills')}>
                  Manage Skills →
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">Dedicated Browser Profiles</strong>
                <span className="setting-hint">
                  Profile 1 (Research) and Profile 2 (WhatsApp) run in isolated user data directories without interfering with your personal Chrome.
                </span>
              </div>
              <div className="setting-action">
                <button type="button" className="btn-secondary" onClick={() => onNavigate('browser')}>
                  Open Browser Manager →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MEMORY */}
      {activeTab === 'memory' && (
        <div className="card section-card">
          <div className="section-head">
            <h3>🧠 Persistent Memory Settings</h3>
          </div>
          <p className="section-desc">
            Rules, preferences, and verified facts are stored locally at <code>data/memory/items.json</code> and injected into agent prompts contextually.
          </p>

          <div className="settings-grid-rows">
            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">Local Storage Policy</strong>
                <span className="setting-hint">
                  Memory entries are stored locally on your machine and never synced to external cloud services. Secrets and passwords are automatically excluded.
                </span>
              </div>
              <div className="setting-action">
                <button type="button" className="btn-secondary" onClick={() => onNavigate('memory')}>
                  Open AI Memory →
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <strong className="setting-title">Clear Memory Storage</strong>
                <span className="setting-hint">Remove all remembered preferences and guidelines.</span>
              </div>
              <div className="setting-action">
                <button
                  type="button"
                  className="btn-danger"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to clear all memory items?')) {
                      await clearMemories()
                      setNotice('Memory storage cleared successfully!')
                    }
                  }}
                >
                  Clear All Memory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: OUTPUTS */}
      {activeTab === 'outputs' && (
        <div className="card section-card">
          <div className="section-head">
            <h3>📁 Output Storage & Directories</h3>
          </div>
          <p className="section-desc">
            Generated Excel-compatible CSVs, reports, and marketing drafts are saved under dedicated subfolders to prevent accidental overwrites.
          </p>

          <div className="setting-row">
            <div className="setting-info">
              <strong className="setting-title">Base Output Directory</strong>
              {editingDir ? (
                <div className="dir-edit-wrap" style={{ marginTop: '8px' }}>
                  <input
                    type="text"
                    value={dirInput}
                    onChange={(e) => setDirInput(e.target.value)}
                    className="dir-input"
                  />
                  <button type="button" className="btn-sm btn-primary" onClick={handleSaveOutputDir}>
                    Save
                  </button>
                  <button type="button" className="btn-sm btn-secondary" onClick={() => setEditingDir(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <span className="dir-path" style={{ marginTop: '8px' }}>
                  <code>{baseDir}</code>
                  <button type="button" className="btn-link" onClick={() => setEditingDir(true)}>
                    Change Path
                  </button>
                </span>
              )}
            </div>
            <div className="setting-action">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void openOutputFolder()}
              >
                Open Outputs Folder ↗
              </button>
            </div>
          </div>

          <div className="browser-quick-grid" style={{ marginTop: '16px' }}>
            <div className="card browser-quick-card">
              <h4>Lead-Hunt Folder</h4>
              <p>Contains all discovered business CSV exports and contact spreadsheets.</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void openOutputFolder('Lead-Hunt')}
              >
                Open Lead-Hunt Folder ↗
              </button>
            </div>

            <div className="card browser-quick-card">
              <h4>Marketing Folder</h4>
              <p>Contains customized Bengali proposals, campaign outlines, and message drafts.</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void openOutputFolder('Marketing')}
              >
                Open Marketing Folder ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: PERMISSIONS */}
      {activeTab === 'permissions' && (
        <div className="card section-card">
          <div className="section-head">
            <h3>🛡️ Security & Auto-Approval Policy (Turbo Mode)</h3>
            <button type="button" className="btn-link" onClick={() => onNavigate('approvals')}>
              Open Approval Center →
            </button>
          </div>
          <div className="notice-banner">
            <h4>✅ Pre-Approved Safe Operations:</h4>
            <p>
              • Reading workspace files (<code>Read</code>, <code>Glob</code>, <code>Grep</code>).
              <br />
              • Running verified development commands (<code>npm run typecheck</code>, <code>npm test</code>, <code>npm run build</code>, <code>git status</code>).
              <br />
              • Writing output CSV files to <code>Documents/OpenGrokBot/Outputs/</code>.
              <br />
              • Public web search and directory lookups in background Chrome profiles.
            </p>
            <h4 style={{ marginTop: '12px' }}>⚠️ Explicit Confirmation Required:</h4>
            <p>
              • Irreversible file deletions outside output directories.
              <br />
              • Reading credentials, SSH keys, or environment secret tokens.
              <br />
              • Dispatching outbound messages or WhatsApp transmissions.
            </p>
          </div>
        </div>
      )}

      {/* TAB 7: SYSTEM */}
      {activeTab === 'system' && (
        <div className="card section-card">
          <div className="section-head">
            <h3>ℹ️ System Information</h3>
          </div>
          <div className="settings-grid-rows">
            <div className="setting-row">
              <span className="setting-info">Application Version</span>
              <strong>OpenGrokBot v0.3.0 Desktop (Windows Turbo)</strong>
            </div>
            <div className="setting-row">
              <span className="setting-info">Windows One-Click Launcher</span>
              <code>OpenGrokBotLauncher.vbs</code>
            </div>
            <div className="setting-row">
              <span className="setting-info">Workspace Directory</span>
              <code>{team.workspace}</code>
            </div>
            <div className="setting-row">
              <span className="setting-info">Backend Server Host</span>
              <code>http://127.0.0.1:4310</code>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
